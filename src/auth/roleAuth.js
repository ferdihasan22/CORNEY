// CORNEY — Autentikasi role PWA (Fase 2 lokal). Menyimpan kredensial 5 role tetap
// (Owner/Operasional/Produksi/Auditor/Supplier), sesi per-role ("Ingat Login"), dan
// kunci anti brute-force: 3x salah → tunggu 10 menit. Kasir TIDAK di sini (per
// cabang, diatur di Kelola Cabang). Keamanan penuh (server, hash) di TAHAP 4.

import { signOutSupabase } from './supabaseAuth.js'

export const ROLE_META = {
  owner: { label: 'Owner', home: '/ops/owner', loginPath: '/ops/owner/login', icon: 'shield_person' },
  operasional: { label: 'Operasional', home: '/ops/operasional', loginPath: '/ops/operasional/login', icon: 'local_shipping' },
  produksi: { label: 'Produksi', home: '/ops/produksi', loginPath: '/ops/produksi/login', icon: 'factory' },
  auditor: { label: 'Auditor', home: '/ops/auditor', loginPath: '/ops/auditor/login', icon: 'verified_user' },
  supplier: { label: 'Supplier', home: '/supplier/request', loginPath: '/supplier', icon: 'inventory_2' },
}
// Default kredensial (diberikan Owner) — bisa diubah di Owner → Manajemen User.
const SEED = {
  owner: { username: 'corney', password: 'ferdiarmy12' },
  operasional: { username: 'ops12', password: 'corneyops12' },
  produksi: { username: 'produksi', password: 'hartatiproduksi12' },
  auditor: { username: 'aduit12', password: 'audtirina12' },
  supplier: { username: 'supplier', password: 'corneysupplier' },
}

const CREDS_KEY = 'corney_role_creds_v1'
const subscribers = new Set()
function loadCreds() { try { const s = JSON.parse(localStorage.getItem(CREDS_KEY)); return s && typeof s === 'object' && !Array.isArray(s) ? { ...SEED, ...s } : { ...SEED } } catch { return { ...SEED } } }
let creds = loadCreds()
function commitCreds(next) { creds = next; localStorage.setItem(CREDS_KEY, JSON.stringify(next)); subscribers.forEach((f) => f()) }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === CREDS_KEY) { creds = loadCreds(); subscribers.forEach((f) => f()) } })
}

export function getRoleCreds() { return creds }
export function subscribeRoleCreds(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }
export function credOf(role) { return creds[role] || { username: '', password: '' } }
export function setRoleCred(role, { username, password }) {
  const cur = creds[role] || { username: '', password: '' }
  commitCreds({
    ...creds,
    [role]: {
      username: username != null ? String(username).trim().toLowerCase() : cur.username,
      password: password != null ? String(password) : cur.password,
    },
  })
}

// ── Sesi per role ("Ingat Login" → localStorage; tidak → sessionStorage) ──
const sessKey = (role) => `corney_sess_${role}`
export function setRoleSession(role, remember) {
  const k = sessKey(role)
  if (remember) { localStorage.setItem(k, '1'); sessionStorage.removeItem(k) }
  else { sessionStorage.setItem(k, '1'); localStorage.removeItem(k) }
}
export function hasRoleSession(role) { const k = sessKey(role); return !!(localStorage.getItem(k) || sessionStorage.getItem(k)) }
export function clearRoleSession(role) { const k = sessKey(role); localStorage.removeItem(k); sessionStorage.removeItem(k); signOutSupabase() }

// ── Kunci login: 3x gagal → kunci 10 menit (per "key", mis. nama role) ──
export const MAX_FAIL = 3
export const LOCK_MS = 10 * 60 * 1000
const lockKey = (key) => `corney_lock_${key}`
export function lockInfo(key) {
  try {
    const s = JSON.parse(localStorage.getItem(lockKey(key))) || {}
    const remainingMs = Math.max(0, (s.until || 0) - Date.now())
    return { fails: s.fails || 0, until: s.until || 0, locked: remainingMs > 0, remainingMs }
  } catch { return { fails: 0, until: 0, locked: false, remainingMs: 0 } }
}
export function recordFail(key) {
  const cur = lockInfo(key)
  let fails = cur.fails + 1
  let until = cur.until
  if (fails >= MAX_FAIL) { until = Date.now() + LOCK_MS; fails = 0 } // kunci & reset hitungan
  localStorage.setItem(lockKey(key), JSON.stringify({ fails, until }))
  return lockInfo(key)
}
export function clearLock(key) { localStorage.removeItem(lockKey(key)) }

// Cek kredensial role. true bila cocok.
export function checkRoleLogin(role, username, password) {
  const c = credOf(role)
  return String(username).trim().toLowerCase() === (c.username || '').toLowerCase() && password === c.password
}
