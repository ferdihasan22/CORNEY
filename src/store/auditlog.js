// CORNEY — Audit log (AUD-04 Jejak Audit, Fase 2 dummy). APPEND-ONLY: who/what/
// when/old→new for refund, correction, void, cash handoff. No edit/delete by
// anyone (incl Owner). In TAHAP 4 this becomes a DB table with no UPDATE/DELETE
// grant. Here we expose only get/subscribe + logAudit (append).
//
// Entry: { id, hash, type ('Stok'|'Refund'|'Void'|'Settlement'), who, branchId,
//   oldVal, newVal, note, at }

const KEY = 'corney_auditlog'
const subscribers = new Set()

function seed() {
  const t = '2026-05-31T'
  return [
    { id: 'AL-seed-3', hash: '#7C1A...F4', type: 'Settlement', who: 'Operasional · Rama', branchId: 'sepinggan', oldVal: 'Rp 0', newVal: 'Rp 856.000 (Setoran)', note: 'Closing shift — saldo fisik sesuai.', at: t + '18:00:00' },
    { id: 'AL-seed-2', hash: '#3B9E...A1', type: 'Refund', who: 'Kasir · Sinta', branchId: 'sepinggan', oldVal: 'Rp 20.000', newVal: 'Rp 0 (Order #012)', note: 'Customer salah pesan varian.', at: t + '19:42:00' },
    { id: 'AL-seed-1', hash: '#9A2F...E1', type: 'Stok', who: 'Owner', branchId: 'gunungsari', oldVal: '8', newVal: '11 (+3 Mozza)', note: 'Koreksi disetujui — barang datang.', at: t + '20:15:00' },
  ]
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : seed() } catch { return seed() } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

export function getAuditLog() { return list }
export function subscribeAuditLog(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Short pseudo-hash (Math.random ok in app runtime). Append only — never mutate.
function genHash() {
  const h = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')
  return `#${h.slice(0, 4)}...${h.slice(4)}`
}
export function logAudit({ type, who, branchId, oldVal, newVal, note }) {
  const entry = { id: 'AL-' + Date.now() + '-' + Math.floor(Math.random() * 1000), hash: genHash(), type: type || 'Stok', who: who || '—', branchId: branchId || '', oldVal: String(oldVal ?? ''), newVal: String(newVal ?? ''), note: (note || '').trim(), at: new Date().toISOString() }
  commit([entry, ...list])
  return entry
}
