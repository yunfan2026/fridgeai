// Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.
export default function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
      <div className="text-4xl">🥦</div>
      <h1 className="text-2xl font-bold">FridgeAI needs setup</h1>
      <p className="text-ink/70">
        Supabase isn’t configured yet. Add your project credentials to a{' '}
        <code className="rounded bg-ink/10 px-1">.env</code> file and rebuild:
      </p>
      <pre className="overflow-x-auto rounded-lg bg-ink p-4 text-xs text-white">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
      </pre>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/70">
        <li>Create a project at supabase.com</li>
        <li>Run <code className="rounded bg-ink/10 px-1">supabase/schema.sql</code> in the SQL editor</li>
        <li>Enable the Google auth provider</li>
        <li>Copy the URL + anon key above, then <code className="rounded bg-ink/10 px-1">npm run build</code></li>
      </ol>
    </div>
  );
}
