// Adapter Supabase untuk Stok Standar (par_stock) — TAHAP 4.
//
// par_stock dilindungi RLS staf-only (baca: operasional/produksi/auditor/kasir;
// tulis: owner). Hidrasi dipicu saat ADA sesi via onAuthStateChange. Tulisan
// lewat outbox (durable offline + anti-clobber).
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'

// commit(nextMap) & getMap() disuntik dari parstock.js (akses state lokal).
export function initParStockSync(commit, getMap) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('par_stock')) return
    const { data, error } = await supabase.from('par_stock').select('branch_id, parent_id, qty')
    if (error || !data) return
    const next = { ...getMap() } // mulai dari cache lokal, lalu timpa dengan DB
    for (const r of data) {
      next[r.branch_id] = { ...(next[r.branch_id] || {}), [r.parent_id]: r.qty }
    }
    commit(next)
  }
  supabase.auth.onAuthStateChange((_event, session) => { if (session) hydrate() })
}

export async function pushPar(branchId, parentId, qty) {
  if (!supabase) return
  enqueue({ kind: 'upsert', table: 'par_stock', onConflict: 'branch_id,parent_id', key: `par_stock:${branchId}:${parentId}`, row: { branch_id: branchId, parent_id: parentId, qty: Math.max(0, Number(qty) || 0) } })
}
