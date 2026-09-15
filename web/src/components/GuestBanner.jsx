import { useState } from 'react';

// Shown while signed in as a guest: reminds them data is device-only and offers
// to convert to a permanent account (which keeps all their data).
export default function GuestBanner({ onUpgrade, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const active = await onUpgrade(email.trim(), password);
      if (active) {
        setOpen(false);
      } else {
        setNotice('Almost done — check your email to confirm and finish saving your account.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-warn/15 px-3 py-2 text-xs text-[#8a5a00]">
        <span className="min-w-0 flex-1">
          Guest mode — saved on this device only. Add an account to keep &amp; share.
        </span>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md bg-ink px-2.5 py-1 font-semibold text-white"
        >
          Save
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-[480px] rounded-t-2xl bg-shell p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/20" />
            <h2 className="text-xl font-bold">Save your account</h2>
            <p className="mt-1 text-sm text-ink/60">
              Keep your inventory and access it from any device. Your current data stays.
            </p>

            <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                className="rounded-xl border border-ink/15 bg-white px-4 py-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Password (min 6 characters)"
                className="rounded-xl border border-ink/15 bg-white px-4 py-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              {notice && <p className="text-sm text-safe">{notice}</p>}
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-accent px-4 py-3 font-semibold text-white shadow-card disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save account'}
              </button>
            </form>

            <button onClick={onSignOut} className="mt-4 w-full text-sm text-ink/50 underline">
              Discard guest session &amp; sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
