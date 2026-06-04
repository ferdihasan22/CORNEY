// Adapter Supabase: supplier_prices (harga versi supplier) — FASE 6.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'

export function initSupplierPricesSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('supplier_prices')) return
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
  enqueue({ kind: 'upsert', table: 'supplier_prices', key: `supplier_prices:${itemId}`, row: { item_id: itemId, price: entry.price || 0, prev: entry.prev ?? null } })
}
