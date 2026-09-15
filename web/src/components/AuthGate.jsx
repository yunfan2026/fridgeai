import { useState } from 'react';

// Sign-in screen: email/password + Google + a privacy-friendly guest option.
export default function AuthGate({ onSignIn, onEmailSignIn, onEmailSignUp, onGuest }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signup') {
        const started = await onEmailSignUp(email.trim(), password);
        if (!started) {
          setNotice('Account created — check your email to confirm, then sign in.');
          setMode('signin');
        }
      } else {
        await onEmailSignIn(email.trim(), password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <div className="text-5xl">🥦</div>
        <h1 className="mt-3 text-3xl font-extrabold">FridgeAI</h1>
        <p className="mt-1 text-ink/60">
          Scan groceries, track what’s fresh, cook before it spoils — together with your household.
        </p>
      </div>

      <div className="flex rounded-xl bg-ink/5 p-1">
        <Tab active={mode === 'signin'} onClick={() => setMode('signin')}>Sign in</Tab>
        <Tab active={mode === 'signup'} onClick={() => setMode('signup')}>Create account</Tab>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
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
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
          className="rounded-xl bg-accent px-4 py-3 font-semibold text-white shadow-card transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-ink/40">
        <span className="h-px flex-1 bg-ink/10" /> or <span className="h-px flex-1 bg-ink/10" />
      </div>

      <button
        onClick={onSignIn}
        className="mx-auto flex w-full items-center justify-center gap-3 rounded-xl border border-ink/15 bg-white px-4 py-3 font-semibold shadow-card transition active:scale-[0.98]"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <button
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await onGuest();
          } catch (err) {
            setError(err.message);
            setBusy(false);
          }
        }}
        disabled={busy}
        className="text-sm text-ink/50 underline disabled:opacity-50"
      >
        Continue as guest — no email needed
      </button>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-white text-ink shadow-card' : 'text-ink/50'
      }`}
    >
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
