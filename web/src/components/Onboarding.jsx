import { useState } from 'react';

// Create a new household or join an existing one by invite code.
export default function Onboarding({ onCreate, onJoin, onSignOut }) {
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'create') await onCreate(name);
      else await onJoin(code);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <div className="text-4xl">🏡</div>
        <h1 className="mt-2 text-2xl font-bold">Set up your kitchen</h1>
        <p className="text-ink/60">Share one inventory with everyone in your home.</p>
      </div>

      <div className="flex rounded-xl bg-ink/5 p-1">
        <TabBtn active={mode === 'create'} onClick={() => setMode('create')}>Create</TabBtn>
        <TabBtn active={mode === 'join'} onClick={() => setMode('join')}>Join with code</TabBtn>
      </div>

      {mode === 'create' ? (
        <input
          className="rounded-xl border border-ink/15 bg-white px-4 py-3"
          placeholder="Household name (e.g. Maple St. Apt 4)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      ) : (
        <input
          className="rounded-xl border border-ink/15 bg-white px-4 py-3 uppercase tracking-widest"
          placeholder="INVITE CODE"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        disabled={busy}
        onClick={submit}
        className="rounded-xl bg-accent px-4 py-3 font-semibold text-white shadow-card transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? 'Working…' : mode === 'create' ? 'Create household' : 'Join household'}
      </button>

      <button onClick={onSignOut} className="text-sm text-ink/50 underline">
        Sign out
      </button>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-white text-ink shadow-card' : 'text-ink/50'
      }`}
    >
      {children}
    </button>
  );
}
