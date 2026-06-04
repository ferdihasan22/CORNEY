// Adapter Supabase untuk daftar item Belanja (shopping_items) — TAHAP 4.
// Tabel shopping_items(id, name, active) ; store: [{id, name}].
// RLS: kasir/operasional/supplier baca; operasional/owner tulis → hidrasi on-auth.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'

export function initShoppingSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('shopping_items')) return
    const { data, error } = await supabase.from('shopping_items').select('id, name, active').order('id')
    if (error || !data) return
    commit(data.filter((r) => r.active !== false).map((r) => ({ id: r.id, name: r.name })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushShoppingItem(item) {
  if (!supabase || !item?.id) return
  enqueue({ kind: 'upsert', table: 'shopping_items', key: `shopping_items:${item.id}`, row: { id: item.id, name: item.name, active: true } })
}
export async function removeShoppingItemRemote(id) {
  if (!supabase) return
  enqueue({ kind: 'delete', table: 'shopping_items', matchId: id, key: `shopping_items_del:${id}` })
}
