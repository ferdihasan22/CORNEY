// CORNEY — Cash deposit store (OPS-04, Fase 2 dummy/local). Money chain:
// Kasir → Operasional → Auditor → Owner, 2-sided confirm at each point. Fase 1
// covers Kasir→Operasional: the kasir DECLARES an amount at closing (status
// 'menunggu'); Operasional COUNTS & CONFIRMS → 'cocok' (match) or 'selisih'
// (diff recorded). Replace with Supabase + RLS in TAHAP 4.
//
// Deposit: { id, branchId, branchName, kasirName, kasirAmount, status
//   ('menunggu'|'cocok'|'selisih'), opsAmount, opsName, selisih, forwarded,
//   createdAt, confirmedAt }

import { logAudit } from './auditlog.js'
import { BRANCHES } from '../data/menu.js'
import { getSalesDaily, rowCashSistem } from './salesdaily.js'
import { isSupabase } from '../lib/backend.js'
import { genUuid } from '../lib/util.js'

const KEY = 'corney_deposits_v4' // ikut reseed salesdaily v4
const subscribers = new Set()

// Setoran tunai = Cash Bersih Sistem (tunai − urgent − refund − gaji) dari MASTER
// LAPORAN, per cabang × tanggal TERBARU. Muncul "menunggu" → Operasional cocokkan.
const tglKey = (t) => { const [d, m, y] = (t || '').split('/'); return Number(y) * 10000 + Number(m) * 100 + Number(d) }
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name || id
function seed() {
  const rows = getSalesDaily()
  if (!rows.length) return []
  const maxKey = Math.max(...rows.map((r) => tglKey(r.tgl)))
  return rows.filter((r) => tglKey(r.tgl) === maxKey).map((r, i) => {
    const p = r.potongan || {}
    const urgentItems = (p.urgent || 0) > 0 ? [{ amount: p.urgent, reason: 'Beli gas / keperluan mendadak' }] : []
    return {
      id: 'DEP-seed-' + i, branchId: r.branchId, branchName: branchName(r.branchId), kasirName: 'Kasir',
      kasirAmount: rowCashSistem(r), tgl: r.tgl,
      rincian: { tunai: r.channels?.tunai || 0, urgent: p.urgent || 0, refund: p.refund || 0, gaji: p.gaji || 0, urgentItems },
      status: 'menunggu', opsAmount: null, opsName: null, selisih: 0, forwarded: false,
      createdAt: '2026-06-02T21:30:00.000Z', confirmedAt: null,
    }
  })
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(s) ? s : seed()
  } catch {
    return seed()
  }
}
let list = load()
function commit(next) {
  list = next
  localStorage.setItem(KEY, JSON.stringify(next))
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./deposits.remote.js').then(({ initDepositsSync }) => initDepositsSync(commit)).catch(() => {})
}

export function getDeposits() {
  return list
}
export function clearDeposits() { commit([]) } // reset bulan baru
export function subscribeDeposits(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

// Kasir declares a deposit (side 1) — called when closing is sent.
export function createDeposit({ branchId, branchName, kasirName, amount, tgl, rincian }) {
  const dep = {
    id: isSupabase() ? genUuid() : 'DEP-' + Date.now(),
    branchId,
    branchName: branchName || branchId,
    kasirName: kasirName || 'Kasir',
    kasirAmount: Math.round(amount || 0),
    tgl: tgl || null,
    rincian: rincian || null, // { tunai, urgent, refund, gaji } — rincian Cash Bersih Sistem
    status: 'menunggu',
    opsAmount: null,
    opsName: null,
    selisih: 0,
    forwarded: false,
    createdAt: new Date().toISOString(),
    confirmedAt: null,
  }
  commit([dep, ...list])
  if (isSupabase()) import('./deposits.remote.js').then((w) => w.pushDeposit(dep)).catch(() => {})
  return dep
}

// Operasional counts & confirms (side 2). selisih = diterima − dinyatakan.
export function confirmDeposit(id, opsAmount, opsName = 'Operasional') {
  let found = null
  const next = list.map((d) => {
    if (d.id !== id || d.status !== 'menunggu') return d
    const amt = Math.round(opsAmount || 0)
    const selisih = amt - d.kasirAmount
    found = { ...d, opsAmount: amt, opsName, selisih, status: selisih === 0 ? 'cocok' : 'selisih', confirmedAt: new Date().toISOString() }
    return found
  })
  if (found) { commit(next); logAudit({ type: 'Settlement', who: `Operasional · ${found.opsName}`, branchId: found.branchId, oldVal: `Kasir Rp ${found.kasirAmount.toLocaleString('id-ID')}`, newVal: `Diterima Rp ${found.opsAmount.toLocaleString('id-ID')} (${found.status})`, note: 'Terima setoran tunai dari kasir.' }); if (isSupabase()) import('./deposits.remote.js').then((w) => w.pushDeposit(found)).catch(() => {}) }
  return found
}

// Forward all collected (confirmed) deposits up the chain (Auditor/Owner).
export function forwardDeposits() {
  const changed = []
  const next = list.map((d) => { if (d.status !== 'menunggu' && !d.forwarded) { const nd = { ...d, forwarded: true }; changed.push(nd); return nd } return d })
  commit(next)
  if (isSupabase()) changed.forEach((d) => import('./deposits.remote.js').then((w) => w.pushDeposit(d)).catch(() => {}))
}

// Auditor (side 3): recount physical, match vs what Operasional received → report
// to Owner. auditorSelisih = recount − opsAmount (pinpoints the ops→auditor leg).
export function auditorVerify(id, auditorAmount, note = '') {
  let found = null
  const next = list.map((d) => {
    if (d.id !== id) return d
    const amt = Math.round(auditorAmount || 0)
    const base = d.opsAmount != null ? d.opsAmount : d.kasirAmount
    const sel = amt - base
    found = { ...d, auditorAmount: amt, auditorSelisih: sel, auditorStatus: sel === 0 ? 'cocok' : 'selisih', auditorNote: (note || '').trim(), auditedAt: new Date().toISOString() }
    return found
  })
  if (found) { commit(next); logAudit({ type: 'Settlement', who: 'Auditor', branchId: found.branchId, oldVal: `Operasional Rp ${(found.opsAmount ?? 0).toLocaleString('id-ID')}`, newVal: `Audit Rp ${found.auditorAmount.toLocaleString('id-ID')} (${found.auditorStatus})`, note: found.auditorNote || 'Verifikasi setoran oleh auditor.' }); if (isSupabase()) import('./deposits.remote.js').then((w) => w.auditorVerifyRemote(found)).catch(() => {}) }
  return found
}
