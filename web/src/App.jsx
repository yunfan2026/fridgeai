import { useState } from 'react';
import { isSupabaseConfigured } from './lib/supabase.js';
import { useSession } from './hooks/useSession.js';
import { useHousehold } from './hooks/useHousehold.js';
import { useInventory } from './hooks/useInventory.js';
import { ToastProvider } from './components/Toast.jsx';
import SetupNeeded from './components/SetupNeeded.jsx';
import AuthGate from './components/AuthGate.jsx';
import Onboarding from './components/Onboarding.jsx';
import ScanView from './components/ScanView.jsx';
import InventoryView from './components/InventoryView.jsx';
import RecipesView from './components/RecipesView.jsx';
import HouseholdSettings from './components/HouseholdSettings.jsx';
import GuestBanner from './components/GuestBanner.jsx';

const TABS = [
  { id: 'scan', icon: '📷', label: 'Scan' },
  { id: 'inventory', icon: '🗂', label: 'Inventory' },
  { id: 'recipes', icon: '🍳', label: 'Recipes' },
];

export default function App() {
  if (!isSupabaseConfigured) return <SetupNeeded />;
  return <AuthedApp />;
}

function AuthedApp() {
  const {
    user,
    loading: sessionLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInAsGuest,
    upgradeWithEmail,
    signOut,
  } = useSession();
  const hh = useHousehold(user);
  const inv = useInventory(hh.household?.id);
  const [tab, setTab] = useState('inventory');
  const [showSettings, setShowSettings] = useState(false);

  if (sessionLoading) return <Splash />;
  if (!user)
    return (
      <AuthGate
        onSignIn={signInWithGoogle}
        onEmailSignIn={signInWithEmail}
        onEmailSignUp={signUpWithEmail}
        onGuest={signInAsGuest}
      />
    );
  if (hh.loading) return <Splash />;
  if (!hh.household) {
    return (
      <Onboarding onCreate={hh.createHousehold} onJoin={hh.joinHousehold} onSignOut={signOut} />
    );
  }

  return (
    <ToastProvider>
      <div className="mx-auto flex h-full max-w-[480px] flex-col bg-shell">
        <header className="flex items-center gap-2 px-4 pb-2 pt-3">
          <span className="text-xl">🥦</span>
          <span className="font-extrabold">FridgeAI</span>
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto rounded-full bg-white px-3 py-1 text-sm font-medium shadow-card"
            title="Household"
          >
            🏡 {hh.household.name}
          </button>
        </header>

        {user.is_anonymous && (
          <GuestBanner onUpgrade={upgradeWithEmail} onSignOut={signOut} />
        )}

        <main className="flex-1 overflow-y-auto pb-24">
          {tab === 'scan' && (
            <ScanView user={user} household={hh.household} inventory={inv} onDone={() => setTab('inventory')} />
          )}
          {tab === 'inventory' && <InventoryView user={user} inventory={inv} />}
          {tab === 'recipes' && <RecipesView user={user} inventory={inv} />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[480px] justify-around border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
                tab === t.id ? 'text-accent' : 'text-ink/50'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {showSettings && (
          <HouseholdSettings
            household={hh.household}
            members={hh.members}
            currentUser={user}
            onClose={() => setShowSettings(false)}
            onSignOut={signOut}
          />
        )}
      </div>
    </ToastProvider>
  );
}

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <span className="animate-pulse text-4xl">🥦</span>
    </div>
  );
}
