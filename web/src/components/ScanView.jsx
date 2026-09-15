import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { scan, captureDate, fileToBase64 } from '../lib/api.js';
import { todayPlusDays, toDateInput } from '../lib/expiry.js';
import { isAlcohol, nameIsAlcohol } from '../lib/alcohol.js';

const LOCATIONS = ['Fridge', 'Freezer', 'Pantry'];

// Convert an API item into an editable review row + snapshot for correction tracking.
function toRow(apiItem) {
  const expiresAt =
    apiItem.expiresAt ||
    (apiItem.shelfLifeDays != null ? todayPlusDays(apiItem.shelfLifeDays) : '');
  const row = {
    key: Math.random().toString(36).slice(2),
    name: apiItem.name || '',
    quantity: apiItem.quantity || 1,
    unit: apiItem.unit || 'pieces',
    location: LOCATIONS.includes(apiItem.suggestedLocation) ? apiItem.suggestedLocation : 'Fridge',
    trackingType: apiItem.trackingType === 'portion' ? 'portion' : 'count',
    category: apiItem.category || 'other',
    flags: apiItem.flags || [],
    confidence: apiItem.confidence ?? 1,
    expiresAt,
    expirySource: apiItem.expirySource || (apiItem.expiresAt ? 'printed' : 'estimate'),
  };
  return { row, original: { name: row.name, quantity: row.quantity, expiresAt: row.expiresAt } };
}

export default function ScanView({ user, household, inventory, onDone }) {
  const [mode, setMode] = useState('groceries');
  const [photos, setPhotos] = useState([]); // { url, base64 }
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState(null); // null = not analyzed yet
  const [originals, setOriginals] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [error, setError] = useState('');
  const addPhotoRef = useRef(null);
  const dateInputRef = useRef(null);
  const dateTargetKey = useRef(null);

  const addPhotos = async (files) => {
    const next = [];
    for (const file of files) {
      next.push({ url: URL.createObjectURL(file), base64: await fileToBase64(file) });
    }
    setPhotos((p) => [...p, ...next]);
  };

  const analyze = async () => {
    setBusy(true);
    setError('');
    try {
      const { items = [], rejected: rej = [] } = await scan(photos.map((p) => p.base64), mode);
      const mapped = items.map(toRow);
      setRows(mapped.map((m) => m.row));
      setOriginals(mapped.map((m) => m.original));
      setRejected(rej);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const patchRow = (key, patch) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));

  // Per-item "Capture date": snap the printed date, OCR it, fill the field.
  const openDateCapture = (key) => {
    dateTargetKey.current = key;
    dateInputRef.current?.click();
  };
  const onDateFile = async (file) => {
    if (!file || !dateTargetKey.current) return;
    const key = dateTargetKey.current;
    patchRow(key, { capturing: true });
    try {
      const { expiresAt } = await captureDate(await fileToBase64(file));
      if (expiresAt) patchRow(key, { expiresAt, expirySource: 'printed', capturing: false });
      else patchRow(key, { capturing: false });
    } catch {
      patchRow(key, { capturing: false });
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = rows
        .filter((r) => r.name.trim())
        .map((r) => {
          const name = r.name.trim();
          // Ensure alcohol is flagged (even if the model missed it) so it's marked in inventory.
          const flags =
            nameIsAlcohol(name) && !r.flags.includes('alcohol')
              ? [...r.flags, 'alcohol']
              : r.flags;
          return {
            name,
            category: r.category,
            location: r.location,
            quantity: Number(r.quantity) || 1,
            unit: r.unit.trim() || 'pieces',
            tracking_type: r.trackingType,
            portion_remaining: 1,
            expires_at: r.expiresAt || null,
            expiry_source: r.expirySource,
            flags,
          };
        });
      await inventory.addItems(payload, user.id);
      await recordFeedback(rows, originals);
      reset();
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Anonymized correction signal for the eval story.
  const recordFeedback = async (finalRows, orig) => {
    const detected = orig.length;
    const deleted = detected - finalRows.length;
    let edited = 0;
    finalRows.forEach((r, i) => {
      const o = orig.find((_, idx) => idx === i);
      if (!o) return;
      if (o.name !== r.name || o.quantity != r.quantity || o.expiresAt !== r.expiresAt) edited += 1;
    });
    const kept = Math.max(0, detected - deleted - edited);
    try {
      await supabase.from('scan_feedback').insert({
        household_id: household.id,
        mode,
        detected,
        kept,
        edited,
        deleted,
      });
    } catch {
      /* feedback is best-effort */
    }
  };

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setRows(null);
    setOriginals([]);
    setRejected([]);
    setError('');
  };

  // ── Review step ──────────────────────────────────────────────────────────
  if (rows) {
    return (
      <div className="px-4">
        <div className="flex items-center py-2">
          <h2 className="text-lg font-bold">Review items</h2>
          <button onClick={reset} className="ml-auto text-sm text-ink/50 underline">
            Start over
          </button>
        </div>

        {rejected.length > 0 && (
          <p className="mb-2 rounded-lg bg-ink/5 px-3 py-2 text-xs text-ink/60">
            Ignored (not food): {rejected.join(', ')}
          </p>
        )}

        <div className="space-y-2.5">
          {rows.map((r) => (
            <ReviewRow
              key={r.key}
              row={r}
              onPatch={(p) => patchRow(r.key, p)}
              onRemove={() => removeRow(r.key)}
              onCaptureDate={() => openDateCapture(r.key)}
            />
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          disabled={busy || !rows.length}
          onClick={save}
          className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-white shadow-card disabled:opacity-50"
        >
          {busy ? 'Saving…' : `Save ${rows.length} item${rows.length === 1 ? '' : 's'} to inventory`}
        </button>

        <input
          ref={dateInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            onDateFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  // ── Capture step ───────────────────────────────────────────────────────────
  return (
    <div className="px-4">
      <h2 className="py-2 text-lg font-bold">Scan groceries</h2>

      <div className="mb-3 flex rounded-xl bg-ink/5 p-1">
        {[
          ['groceries', '📷 Groceries'],
          ['receipt', '🧾 Receipt'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === id ? 'bg-white shadow-card' : 'text-ink/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {photos.length > 0 && (
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <div key={i} className="relative shrink-0">
              <img src={p.url} alt="" className="h-24 w-24 rounded-lg object-cover" />
              <button
                onClick={() => setPhotos((ps) => ps.filter((_, idx) => idx !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <label
        htmlFor="add-photo"
        className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-accent/40 bg-white py-8 text-center"
      >
        <span className="text-3xl">{mode === 'receipt' ? '🧾' : '📷'}</span>
        <span className="font-semibold text-accent">
          {photos.length ? 'Add another photo' : `Tap to add a ${mode === 'receipt' ? 'receipt' : 'grocery'} photo`}
        </span>
        <span className="text-xs text-ink/50">
          {mode === 'receipt'
            ? 'Snap the whole receipt'
            : 'Add several photos — item labels, expiry dates, the haul'}
        </span>
        <input
          id="add-photo"
          ref={addPhotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => {
            addPhotos([...e.target.files]);
            e.target.value = '';
          }}
        />
      </label>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {photos.length > 0 && (
        <button
          disabled={busy}
          onClick={analyze}
          className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-white shadow-card disabled:opacity-50"
        >
          {busy ? 'Analyzing…' : `Analyze ${photos.length} photo${photos.length === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  );
}

function ReviewRow({ row, onPatch, onRemove, onCaptureDate }) {
  const lowConf = row.confidence < 0.6;
  const alcohol = isAlcohol({ name: row.name, flags: row.flags });
  const isEstimate = row.expirySource === 'estimate';

  return (
    <div className={`rounded-xl bg-white p-3 shadow-card ${lowConf ? 'ring-1 ring-warn' : ''}`}>
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 font-semibold outline-none"
          value={row.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Item name"
        />
        {lowConf && <span title="low confidence — please check" className="text-xs">⚠️</span>}
        {alcohol && <span className="text-xs">🍷</span>}
        <button onClick={onRemove} className="text-ink/40">
          ✕
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <label className="flex items-center gap-1">
          <span className="text-xs text-ink/50">Qty</span>
          <input
            type="number"
            min="0"
            step="0.5"
            className="w-full rounded border border-ink/15 px-2 py-1"
            value={row.quantity}
            onChange={(e) => onPatch({ quantity: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-xs text-ink/50">Unit</span>
          <input
            className="w-full rounded border border-ink/15 px-2 py-1"
            value={row.unit}
            onChange={(e) => onPatch({ unit: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-xs text-ink/50">Loc</span>
          <select
            className="w-full rounded border border-ink/15 px-2 py-1"
            value={row.location}
            onChange={(e) => onPatch({ location: e.target.value })}
          >
            {LOCATIONS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-xs text-ink/50">Exp</span>
          <input
            type="date"
            className="w-full rounded border border-ink/15 px-2 py-1"
            value={row.expiresAt ? toDateInput(row.expiresAt) : ''}
            onChange={(e) => onPatch({ expiresAt: e.target.value, expirySource: 'printed' })}
          />
        </label>
      </div>

      {isEstimate && !alcohol && (
        <button
          onClick={onCaptureDate}
          className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent"
        >
          {row.capturing ? '📸 Reading date…' : '📸 Estimate — capture printed date'}
        </button>
      )}
    </div>
  );
}
