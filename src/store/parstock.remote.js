// Adapter Supabase untuk Stok Standar (par_stock) — TAHAP 4.
//
// par_stock dilindungi RLS staf-only (baca: operasional/produksi/auditor/kasir;
// tulis: owner). Karena itu hidrasi TAK bisa saat init (anon) seperti master —
// dipicu saat ADA sesi via onAuthStateChange (INITIAL_SESSION saat sesi
// "diingat" sudah ada, atau SIGNED_IN saat baru login). Pola ini reusable untuk
// store staf lain (analisa, shopping_items, investor_config).
//
// Dipanggil lewat dynamic import dari parstock.js HANYA saat VITE_BACKEND=supabase.

import { supabase } from '../lib/supabase.js'

// commit(nextMap) & getMap() disuntik dari parstock.js (akses state lokal).
export function initParStockSync(commit, getMap) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('par_stock').select('branch_id, parent_id, qty')
    if (error || !data) return
    const next = { ...getMap() } // mulai dari cache lokal, lalu timpa dengan DB
    for (const r of data) {
      next[r.branch_id] = { ...(next[r.branch_id] || {}), [r.parent_id]: r.qty }
    }
    commit(next)
  }
  // Fires INITIAL_SESSION (sesi tersimpan) lalu SIGNED_IN/TOKEN_REFRESHED.
  supabase.auth.onAuthStateChange((_event, session) => { if (session) hydrate() })
}

export async function pushPar(branchId, parentId, qty) {
  if (!supabase) return
  const { error } = await supabase.from('par_stock').upsert({
    branch_id: branchId, parent_id: parentId, qty: Math.max(0, Number(qty) || 0),
  })
  if (error) console.warn(`[parstock.write] upsert ${branchId}/${parentId} gagal:`, error.message || error)
}
