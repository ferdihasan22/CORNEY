// Adapter Supabase untuk Analisa Bahan (batas aman per material) — TAHAP 4.
// Tabel analisa(ingredient_id, per_unit) ; store: { materialId: batas(number) }.
// RLS staf (owner/auditor/operasional baca; owner tulis) → hidrasi on-auth.
import { supabase } from '../lib/supabase.js'

export function initAnalisaSync(commit, getMap) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('analisa').select('ingredient_id, per_unit')
    if (error || !data) return
    const next = { ...getMap() }
    for (const r of data) next[r.ingredient_id] = Number(r.per_unit) || 0
    commit(next)
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushAnalisa(id, batas) {
  if (!supabase) return
  const { error } = await supabase.from('analisa').upsert({ ingredient_id: id, per_unit: Math.max(0, Number(batas) || 0) })
  if (error) console.warn('[analisa.write] upsert ' + id + ':', error.message || error)
}
