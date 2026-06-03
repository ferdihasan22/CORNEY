// CORNEY — Uang Belanjaan (biaya) per TANGGAL + CABANG, diisi Owner di tab Laba Bersih.
// Laba Bersih = Sisa Bersih (dari Omzet Bersih) − Uang Belanjaan.
// Row: { tgl, branchId, amount }. Dummy/localStorage; TAHAP 4 → backend.
import { isSupabase } from '../lib/backend.js'

const KEY = 'corney_expense_v2'
const subscribers = new Set()

function seed() {
  return [
    { tgl: '02/06/2026', branchId: 'sepinggan', amount: 300000 },
    { tgl: '02/06/2026', branchId: 'gunungsari', amount: 220000 },
  ]
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : seed() } catch { return seed() } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber → laba salah).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./expense.remote.js').then(({ initExpenseSync }) => initExpenseSync(commit)).catch(() => {})
}

export function getExpense() { return list }
export function subscribeExpense(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// Set/timpa uang belanjaan untuk satu tgl+cabang.
export function setExpense(tgl, branchId, amount) {
  const amt = Math.max(0, amount || 0)
  const ex = list.find((e) => e.tgl === tgl && e.branchId === branchId)
  if (ex) commit(list.map((e) => (e === ex ? { ...e, amount: amt } : e)))
  else commit([{ tgl, branchId, amount: amt }, ...list])
  if (isSupabase()) import('./expense.remote.js').then((w) => w.pushExpense(tgl, branchId, amt)).catch(() => {})
}
export function expenseAmount(tgl, branchId) {
  const e = list.find((x) => x.tgl === tgl && x.branchId === branchId)
  return e ? e.amount : 0
}
export function clearExpense() { commit([]) } // reset bulan baru
