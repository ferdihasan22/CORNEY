// Adapter Supabase: ledger (buku besar pembelian) — TAHAP 4. Owner R/W; auditor baca.
import { supabase } from '../lib/supabase.js'
const fromRow = (r) => ({ id: r.id, item: r.item, unit: r.unit, latestPrice: r.latest_price, prevPrice: r.prev_price, ordered: r.ordered, received: r.received, lastDate: r.last_date })

export function initLedgerSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    const { data, error } = await supabase.from('ledger').select('*')
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushLedgerRow(r) {
  if (!supabase || !r?.id) return
  const { error } = await supabase.from('ledger').upsert({ id: r.id, item: r.item, unit: r.unit, latest_price: r.latestPrice, prev_price: r.prevPrice, ordered: r.ordered, received: r.received, last_date: r.lastDate })
  if (error) console.warn('[ledger.write]', error.message || error)
}
