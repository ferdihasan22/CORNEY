// CORNEY — Month-close store (Tutup Bulan, Fase 2 dummy). Mengunci satu bulan dan
// MEMBEKUKAN angka finalnya (laba final → bagi hasil investor OWN-11) lewat SNAPSHOT,
// supaya koreksi Master Laporan setelah dikunci TIDAK mengubah angka final diam-diam.
// Shape: { closed: { 'YYYY-MM': { at, branches: { [id]: { omzet, laba, biaya, sewa, gaji, value, pct } } } } }

import { isSupabase } from '../lib/backend.js'

const KEY = 'corney_monthclose'
const subscribers = new Set()
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' ? s : { closed: {} } } catch { return { closed: {} } } }
let state = load()
function commit(next) { state = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); subscribers.forEach((fn) => fn()) } })
}

if (isSupabase()) {
  import('./monthclose.remote.js').then(({ initMonthCloseSync }) => initMonthCloseSync(commit)).catch(() => {})
}

export function getMonthClose() { return state }
export function subscribeMonthClose(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function isMonthClosed(key) { return !!(state.closed || {})[key] }
// Snapshot beku bulan (atau null bila belum dikunci).
export function getMonthSnapshot(key) { return (state.closed || {})[key] || null }

// Kunci bulan + BEKUKAN angka. snapshot = { branches: {...} } dihitung saat dikunci.
export function lockMonth(key, snapshot) {
  const closed = { ...(state.closed || {}) }
  const snap = { at: new Date().toISOString(), ...(snapshot || {}) }
  closed[key] = snap
  commit({ ...state, closed })
  if (isSupabase()) import('./monthclose.remote.js').then((w) => w.pushMonthClose(key, snap)).catch(() => {})
}
export function unlockMonth(key) {
  const closed = { ...(state.closed || {}) }
  delete closed[key]
  commit({ ...state, closed })
  if (isSupabase()) import('./monthclose.remote.js').then((w) => w.deleteMonthCloseRemote(key)).catch(() => {})
}
