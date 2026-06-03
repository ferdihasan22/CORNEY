// Adapter Supabase untuk daftar item Belanja (shopping_items) — TAHAP 4.
// Tabel shopping_items(id, name, active) ; store: [{id, name}].
// RLS: kasir/operasional/supplier baca; operasional/owner tulis → hidrasi on-auth.
import { supabase } from '../lib/supabase.js'

export function initShoppingSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('shopping_items').select('id, name, active').order('id')
    if (error || !data) return
    commit(data.filter((r) => r.active !== false).map((r) => ({ id: r.id, name: r.name })))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushShoppingItem(item) {
  if (!supabase || !item?.id) return
  const { error } = await supabase.from('shopping_items').upsert({ id: item.id, name: item.name, active: true })
  if (error) console.warn('[shopping.write] upsert:', error.message || error)
}
export async function removeShoppingItemRemote(id) {
  if (!supabase) return
  const { error } = await supabase.from('shopping_items').delete().eq('id', id)
  if (error) console.warn('[shopping.write] delete:', error.message || error)
}
