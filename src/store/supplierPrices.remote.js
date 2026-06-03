// Adapter Supabase: supplier_prices (harga versi supplier) — FASE 6.
import { supabase } from '../lib/supabase.js'

export function initSupplierPricesSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('supplier_prices').select('*')
    if (error || !data) return
    const out = {}
    data.forEach((r) => { out[r.item_id] = { price: r.price || 0, prev: r.prev ?? null, at: r.at ? String(r.at).slice(0, 10) : '' } })
    commit(out)
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushSupplierPrice(itemId, entry) {
  if (!supabase || !itemId) return
  const { error } = await supabase.from('supplier_prices').upsert({ item_id: itemId, price: entry.price || 0, prev: entry.prev ?? null })
  if (error) console.warn('[sprice.write]', error.message || error)
}
