import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { weekStartMonday } from '../lib/week.js';

// Loads a household's items + waste log and keeps them live via Supabase Realtime.
export function useInventory(householdId) {
  const [items, setItems] = useState([]);
  const [wasteLog, setWasteLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const householdRef = useRef(householdId);
  householdRef.current = householdId;

  const load = useCallback(async () => {
    if (!supabase || !householdId) {
      setItems([]);
      setWasteLog([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [itemsRes, wasteRes] = await Promise.all([
      supabase.from('items').select('*').eq('household_id', householdId),
      supabase
        .from('waste_log')
        .select('*')
        .eq('household_id', householdId)
        .gte('created_at', weekStartMonday().toISOString())
        .order('created_at', { ascending: false }),
    ]);
    setItems(itemsRes.data || []);
    setWasteLog(wasteRes.data || []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: any change to this household's items/waste triggers a reload.
  useEffect(() => {
    if (!supabase || !householdId) return;
    const channel = supabase
      .channel(`household:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${householdId}` },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waste_log', filter: `household_id=eq.${householdId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addItems = async (rows, addedBy) => {
    const payload = rows.map((r) => ({ ...r, household_id: householdId, added_by: addedBy }));
    const { error } = await supabase.from('items').insert(payload);
    if (error) throw new Error(error.message);
    await load();
  };

  const updateItem = async (id, patch) => {
    const { error } = await supabase.from('items').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    await load();
  };

  const deleteItem = async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await load();
  };

  const logWaste = async (entry, userId) => {
    const { data } = await supabase
      .from('waste_log')
      .insert({ ...entry, household_id: householdId, user_id: userId })
      .select()
      .maybeSingle();
    return data;
  };

  // Re-insert a previously-removed item (new id) and undo an optional waste entry.
  const restoreItem = (item, wasteEntry) => async () => {
    // eslint-disable-next-line no-unused-vars
    const { id, added_at, ...rest } = item;
    await supabase.from('items').insert(rest);
    if (wasteEntry?.id) await supabase.from('waste_log').delete().eq('id', wasteEntry.id);
    await load();
  };

  // Consume the whole item (or throw it away): log + remove. Returns an undo fn.
  // Amount is recorded by tracking type so the weekly tally is meaningful:
  //  • portion items → the fraction remaining (a bottle finished = 1, never double-counted)
  //  • count items   → the number of units
  const consumeItem = async (item, reason, userId) => {
    const isPortion = item.tracking_type === 'portion';
    const waste = await logWaste(
      {
        item_name: item.name,
        reason,
        qty: isPortion ? null : item.quantity,
        portion: isPortion ? item.portion_remaining : null,
      },
      userId
    );
    await deleteItem(item.id);
    return restoreItem(item, waste);
  };

  // Countable step: reduce quantity by `by`; at <=0 log the last unit consumed and remove.
  // Returns an undo fn.
  const stepQuantity = async (item, by, userId) => {
    const next = Number((item.quantity + by).toFixed(2));
    let waste = null;
    if (by < 0) {
      waste = await logWaste({ item_name: item.name, reason: 'consumed', qty: Math.abs(by) }, userId);
    }
    if (next <= 0) {
      await deleteItem(item.id);
      return restoreItem(item, waste);
    }
    await updateItem(item.id, { quantity: next });
    return async () => {
      await updateItem(item.id, { quantity: item.quantity });
      if (waste?.id) await supabase.from('waste_log').delete().eq('id', waste.id);
    };
  };

  // Portion set: update remaining fraction; at 0 log consumed and remove. Returns an undo fn.
  const setPortion = async (item, fraction, userId) => {
    const consumed = Math.max(0, item.portion_remaining - fraction);
    let waste = null;
    if (consumed > 0) {
      waste = await logWaste({ item_name: item.name, reason: 'consumed', portion: consumed }, userId);
    }
    if (fraction <= 0) {
      await deleteItem(item.id);
      return restoreItem(item, waste);
    }
    await updateItem(item.id, { portion_remaining: fraction });
    return async () => {
      await updateItem(item.id, { portion_remaining: item.portion_remaining });
      if (waste?.id) await supabase.from('waste_log').delete().eq('id', waste.id);
    };
  };

  return {
    items,
    wasteLog,
    loading,
    reload: load,
    addItems,
    updateItem,
    deleteItem,
    consumeItem,
    stepQuantity,
    setPortion,
    logWaste,
  };
}
