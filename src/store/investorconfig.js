// CORNEY — Konfigurasi Bagi Hasil Investor per cabang (biaya tetap bulanan + %).
// DIPERSIST (sebelumnya useState lokal di OwnerInvestor yang hilang tiap refresh).
// Default 0 → owner WAJIB isi saat go-live (bukan angka dummy). Dummy/localStorage;
// TAHAP 4 → backend.
import { BRANCHES } from '../data/menu.js'

const KEY = 'corney_investor_cfg_v1'
const subscribers = new Set()
const blank = () => ({ sewa: 0, gaji: 0, value: 0, pct: 0 })

function seed() { const o = {}; BRANCHES.forEach((b) => { o[b.id] = blank() }); return o }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && typeof s === 'object' && !Array.isArray(s) ? s : seed() } catch { return seed() } }
let map = load()
function commit(next) { map = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

// Sinkron antar-tab: reload saat tab lain menulis.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { map = load(); subscribers.forEach((fn) => fn()) } })
}

export function getInvestorConfig() { return map }
export function subscribeInvestorConfig(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }
export function investorCfgOf(branchId) { return map[branchId] || blank() }

export function setInvestorField(branchId, key, val) {
  const cur = map[branchId] || blank()
  const v = Math.max(0, Number(String(val).replace(/\D/g, '')) || 0)
  commit({ ...map, [branchId]: { ...cur, [key]: key === 'pct' ? Math.min(100, v) : v } })
}
