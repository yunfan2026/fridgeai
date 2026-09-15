import { useState } from 'react';
import ItemCard from './ItemCard.jsx';
import DetailSheet from './DetailSheet.jsx';
import { useToast } from './Toast.jsx';
import { daysLeft, expiryLabel } from '../lib/expiry.js';
import { weekRangeLabel, shortDay } from '../lib/week.js';

const LOCATIONS = ['Fridge', 'Freezer', 'Pantry'];

// Amount label for a waste entry: "50%" for a partial portion, "×2" for a count.
function amountLabel(e) {
  if (e.portion != null && e.portion < 1) return `${Math.round(e.portion * 100)}%`;
  if (e.qty && e.qty !== 1) return `×${e.qty}`;
  return '';
}

// How much of a "thing" one entry represents: a portion fraction (so half + half
// of one bottle = 1), or a count of units. Sums across a week give whole numbers
// once items are fully finished.
function amountOf(e) {
  return e.portion != null ? e.portion : e.qty || 1;
}

// Show 1 for whole numbers, one decimal otherwise (e.g. a half-finished bottle → 0.5).
function fmtCount(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function InventoryView({ user, inventory }) {
  const showToast = useToast();
  const { items, wasteLog, loading } = inventory;
  const [sheet, setSheet] = useState(null); // 'expiring' | 'eaten' | 'wasted' | null

  const expiringItems = items
    .filter((i) => {
      const d = daysLeft(i.expires_at);
      return d !== null && d <= 3;
    })
    .sort((a, b) => (daysLeft(a.expires_at) ?? 9999) - (daysLeft(b.expires_at) ?? 9999));

  const consumed = wasteLog.filter((e) => e.reason === 'consumed');
  const thrown = wasteLog.filter((e) => e.reason === 'thrown');
  const sum = (arr) => arr.reduce((s, e) => s + amountOf(e), 0);

  const withUndo = async (fn, message) => {
    try {
      const undo = await fn();
      showToast(message, { actionLabel: 'Undo', onAction: () => undo?.() });
    } catch (e) {
      showToast(e.message);
    }
  };

  const handleUsedUp = (item) =>
    withUndo(() => inventory.consumeItem(item, 'consumed', user.id), `Used up ${item.name}`);
  const handleThrewAway = (item) =>
    withUndo(() => inventory.consumeItem(item, 'thrown', user.id), `Tossed ${item.name}`);
  const handleStep = (item, by) =>
    withUndo(() => inventory.stepQuantity(item, by, user.id), `Updated ${item.name}`);
  const handlePortion = (item, fraction) =>
    withUndo(() => inventory.setPortion(item, fraction, user.id), `Updated ${item.name}`);

  // Rows for the tapped-stat sheet.
  const sheetProps = () => {
    if (sheet === 'expiring')
      return {
        title: 'Expiring soon',
        subtitle: 'Within 3 days — use these first',
        emptyText: 'Nothing expiring in the next 3 days. Nice.',
        rows: expiringItems.map((i) => ({
          left: i.name,
          right: expiryLabel(i.expires_at),
          tone: (daysLeft(i.expires_at) ?? 9) <= 2 ? 'danger' : 'warn',
        })),
      };
    const list = sheet === 'wasted' ? thrown : consumed;
    return {
      title: sheet === 'wasted' ? 'Wasted this week' : 'Eaten this week',
      subtitle: weekRangeLabel(),
      emptyText: sheet === 'wasted' ? 'No food wasted this week 🎉' : 'Nothing logged yet this week.',
      rows: list.map((e) => {
        const amt = amountLabel(e);
        return {
          left: amt ? `${e.item_name} · ${amt}` : e.item_name,
          right: shortDay(e.created_at),
          tone: sheet === 'wasted' ? 'danger' : undefined,
        };
      }),
    };
  };

  return (
    <div className="px-4">
      <div className="flex items-baseline justify-between py-2">
        <h2 className="text-lg font-bold">Inventory</h2>
        <span className="text-xs text-ink/40">This week · {weekRangeLabel()}</span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat n={expiringItems.length} label="expiring ≤3d" tone={expiringItems.length ? 'warn' : ''} onClick={() => setSheet('expiring')} />
        <Stat n={fmtCount(sum(consumed))} label="eaten" onClick={() => setSheet('eaten')} />
        <Stat n={fmtCount(sum(thrown))} label="wasted" tone={sum(thrown) ? 'danger' : ''} emphasize onClick={() => setSheet('wasted')} />
      </div>

      {loading ? (
        <p className="py-8 text-center text-ink/40">Loading…</p>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-ink/50">
          <div className="text-4xl">🛒</div>
          <p className="mt-2">No items yet. Scan a grocery photo or receipt to get started.</p>
        </div>
      ) : (
        LOCATIONS.map((loc) => {
          const group = items
            .filter((i) => i.location === loc)
            .sort((a, b) => (daysLeft(a.expires_at) ?? 9999) - (daysLeft(b.expires_at) ?? 9999));
          if (!group.length) return null;
          return (
            <section key={loc} className="mb-4">
              <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-ink/50">{loc}</h3>
              <div className="space-y-2">
                {group.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onUsedUp={() => handleUsedUp(item)}
                    onThrewAway={() => handleThrewAway(item)}
                    onStep={(by) => handleStep(item, by)}
                    onSetPortion={(f) => handlePortion(item, f)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {sheet && <DetailSheet {...sheetProps()} onClose={() => setSheet(null)} />}
    </div>
  );
}

function Stat({ n, label, tone, emphasize, onClick }) {
  const numColor = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-[#8a5a00]' : 'text-ink';
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-2.5 text-center shadow-card transition active:scale-[0.97] ${
        emphasize ? 'bg-danger/5 ring-1 ring-danger/15' : 'bg-white'
      }`}
    >
      <div className={`text-xl font-extrabold ${numColor}`}>{n}</div>
      <div className="text-[11px] leading-tight text-ink/50">{label} ›</div>
    </button>
  );
}
