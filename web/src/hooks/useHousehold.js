import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Loads the current user's household membership. If none, the caller shows onboarding.
export function useHousehold(user) {
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setHousehold(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    // First household the user belongs to (v2 supports one active household per user).
    const { data: membership, error: mErr } = await supabase
      .from('household_members')
      .select('household_id, role, households(id, name, invite_code, created_at)')
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (mErr) {
      setError(mErr.message);
      setLoading(false);
      return;
    }
    if (!membership) {
      setHousehold(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    setHousehold({ ...membership.households, role: membership.role });

    // Roster (names come from auth metadata the members chose; fall back to a short id).
    const { data: roster } = await supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('household_id', membership.household_id)
      .order('joined_at', { ascending: true });
    setMembers(roster || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createHousehold = async (name) => {
    const { data, error: e } = await supabase.rpc('create_household', { p_name: name });
    if (e) throw new Error(e.message);
    await refresh();
    return data;
  };

  const joinHousehold = async (code) => {
    const { data, error: e } = await supabase.rpc('join_household', { p_code: code });
    if (e) throw new Error(e.message);
    await refresh();
    return data;
  };

  return { household, members, loading, error, refresh, createHousehold, joinHousehold };
}
