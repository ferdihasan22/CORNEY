// Adapter Supabase untuk Orders (TAHAP 4, FASE 3 — realtime, inti uang).
//
// Dipakai orders.js HANYA saat VITE_BACKEND=supabase (dynamic import → bundle
// mode local tetap ramping). Dua sisi:
//   - CUSTOMER (anon): insert order, lalu tulis via RPC ber-PIN (anon tak boleh
//     update orders langsung). Baca order sendiri via get_my_order(id,pin).
//   - KASIR/staf: hidrasi + realtime subscribe (RLS kasir_rw_own / staff_read),
//     update order langsung. Customer JANGAN buka channel (batas koneksi).

import { supabase } from '../lib/supabase.js'

// ── Pemetaan store(camelCase) <-> tabel(snake_case) ──
function localBizDate(iso) {
  const x = iso ? new Date(iso) : new Date() // tanggal LOKAL (WIB/WITA) = tanggal usaha
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
function toRow(o) {
  return {
    id: o.id,
    // no: JANGAN dikirim — trigger set_order_no mengisinya (anti-balapan)
    order_date: o.orderDate || localBizDate(o.createdAt),
    branch_id: o.branchId,
    lines: o.lines,
    subtotal: o.subtotal ?? 0,
    discount: o.discount ?? 0,
    total: o.total ?? 0,
    method: o.method || 'ambil',
    schedule: o.schedule || null,
    name: o.name || null,
    wa: o.wa || null,
    pin: o.pin || null,
    status: o.status || 'baru',
    paid: !!o.paid,
    pay_method: o.payMethod || 'qris',
    contacted: !!o.contacted,
    cooking: o.cook || {},
    promo_code: o.promoCode || null,
  }
}
export function fromRow(r) {
  if (!r) return null
  return {
    id: r.id, no: r.no, branchId: r.branch_id, lines: r.lines, subtotal: r.subtotal,
    discount: r.discount, total: r.total, method: r.method, schedule: r.schedule,
    name: r.name, wa: r.wa, pin: r.pin, status: r.status, paid: r.paid,
    payMethod: r.pay_method, contacted: r.contacted, cook: r.cooking || {},
    promoCode: r.promo_code, createdAt: r.created_at, orderDate: r.order_date,
    // jaga field lokal yang tak ada di tabel (mis. address) → diisi caller bila perlu
  }
}
const one = (data) => fromRow(Array.isArray(data) ? data[0] : data)

// ── CUSTOMER ──
// Insert (anon) lalu baca-balik via RPC untuk dapat nomor antrian (no) dari trigger.
export async function insertOrder(order) {
  if (!supabase) throw new Error('Supabase belum siap')
  const { error } = await supabase.from('orders').insert(toRow(order))
  if (error) throw error
  const { data, error: e2 } = await supabase.rpc('get_my_order', { p_id: order.id, p_pin: order.pin })
  if (e2) throw e2
  // gabung field lokal (address dll) yang tak disimpan di tabel
  return { ...order, ...one(data) }
}
export async function fetchMyOrder(id, pin) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_my_order', { p_id: id, p_pin: pin })
  if (error) return null
  return one(data)
}
export async function rpcMarkPaid(id, pin) {
  if (!supabase) return null
  const { data } = await supabase.rpc('customer_mark_paid', { p_id: id, p_pin: pin })
  return one(data)
}
export async function rpcCancel(id, pin) {
  if (!supabase) return
  await supabase.rpc('customer_cancel_order', { p_id: id, p_pin: pin })
}
export async function rpcMarkContacted(id, pin) {
  if (!supabase) return null
  const { data } = await supabase.rpc('customer_mark_contacted', { p_id: id, p_pin: pin })
  return one(data)
}

// ── KASIR/staf ──
// Update order (RLS kasir_rw_own). patch camelCase → kolom.
export async function updateOrderRemote(id, patch) {
  if (!supabase) return
  const row = {}
  if ('status' in patch) row.status = patch.status
  if ('paid' in patch) row.paid = patch.paid
  if ('contacted' in patch) row.contacted = patch.contacted
  if ('cook' in patch) row.cooking = patch.cook
  if ('payMethod' in patch) row.pay_method = patch.payMethod
  const { error } = await supabase.from('orders').update(row).eq('id', id)
  if (error) console.warn('[orders.write] update ' + id + ' gagal:', error.message || error)
}

// Hidrasi + realtime — dipicu saat ADA sesi staf. commit() disuntik dari orders.js.
export function initKasirOrdersSync(commit) {
  if (!supabase) return
  let channel = null
  const hydrate = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (error || !data) return
    commit(data.map(fromRow))
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) return
    hydrate()
    if (!channel) {
      channel = supabase.channel('orders-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, hydrate)
        .subscribe()
    }
  })
}
