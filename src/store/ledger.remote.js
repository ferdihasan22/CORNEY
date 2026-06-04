// Adapter Supabase: ledger (buku besar pembelian) — TAHAP 4. Owner R/W; auditor baca.
import { supabase } from '../lib/supabase.js'
import { enqueue, flush, hasPending } from './outbox.js'
const fromRow = (r) => ({ id: r.id, item: r.item, unit: r.unit, latestPrice: r.latest_price, prevPrice: r.prev_price, ordered: r.ordered, received: r.received, lastDate: r.last_date })

export function initLedgerSync(commit) {
  if (!supabase) return
  const hydrate = async () => {
    await flush(); if (hasPending('ledger')) return
    const { data, error } = await supabase.from('ledger').select('*')
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_e, s) => { if (s) hydrate() })
}
export async function pushLedgerRow(r) {
  if (!supabase || !r?.id) return
  enqueue({ kind: 'upsert', table: 'ledger', key: `ledger:${r.id}`, row: { id: r.id, item: r.item, unit: r.unit, latest_price: r.latestPrice, prev_price: r.prevPrice, ordered: r.ordered, received: r.received, last_date: r.lastDate } })
}
