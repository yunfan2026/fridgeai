import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Tracks the Supabase auth session and exposes sign-in/out helpers.
export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

  const signInWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  // "Continue as guest" — a real but email-less account (privacy-friendly).
  const signInAsGuest = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
  };

  // Convert a guest into a permanent account (keeps all their data).
  // Returns true if the account is active immediately, false if email confirmation is pending.
  const upgradeWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.updateUser({ email, password });
    if (error) throw new Error(error.message);
    return Boolean(data?.user?.email_confirmed_at);
  };

  // Returns true if a session started immediately, false if email confirmation is required.
  const signUpWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return Boolean(data.session);
  };

  const signOut = () => supabase.auth.signOut();

  return {
    session,
    user: session?.user ?? null,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInAsGuest,
    upgradeWithEmail,
    signOut,
  };
}
