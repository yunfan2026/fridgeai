import { useState } from 'react';

export default function HouseholdSettings({ household, members, currentUser, onClose, onSignOut }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(household.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the code is shown on screen anyway */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-2xl bg-shell p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/20" />
        <h2 className="text-xl font-bold">{household.name}</h2>

        <div className="mt-4 rounded-xl bg-white p-4 shadow-card">
          <p className="text-sm text-ink/60">Invite code — share to add roommates</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-2xl font-extrabold tracking-[0.3em]">{household.invite_code}</span>
            <button
              onClick={copyCode}
              className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-ink/60">
            Members ({members.length})
          </p>
          <div className="space-y-1.5">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-card"
              >
                <span>
                  {m.user_id === currentUser.id ? 'You' : `Member ${m.user_id.slice(0, 6)}`}
                </span>
                <span className="text-xs uppercase text-ink/40">{m.role}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onSignOut}
          className="mt-6 w-full rounded-xl border border-ink/15 py-2.5 text-sm font-semibold text-ink/70"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
