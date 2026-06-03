// CORNEY — User management store (Owner, Fase 2 dummy). Owner manages staff
// accounts per role/branch. Real auth (passwords/reset) via Supabase TAHAP 4.
//
// User: { id, name, role ('kasir'|'operasional'|'produksi'|'auditor'), branchId, active }

const KEY = 'corney_users'
const subscribers = new Set()

function seed() {
  return [
    { id: 'U1', name: 'Sinta', role: 'kasir', branchId: 'sepinggan', active: true },
    { id: 'U2', name: 'Budi', role: 'kasir', branchId: 'gunungsari', active: true },
    { id: 'U3', name: 'Rama', role: 'operasional', branchId: '', active: true },
    { id: 'U4', name: 'Dewi', role: 'produksi', branchId: '', active: true },
    { id: 'U5', name: 'Pak Yanto', role: 'auditor', branchId: '', active: false },
  ]
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(s) ? s : seed() } catch { return seed() } }
let list = load()
function commit(next) { list = next; localStorage.setItem(KEY, JSON.stringify(next)); subscribers.forEach((fn) => fn()) }

export function getUsers() { return list }
export function subscribeUsers(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function addUser({ name, role, branchId }) {
  const u = { id: 'U' + Date.now(), name: (name || '').trim(), role: role || 'kasir', branchId: branchId || '', active: true }
  if (!u.name) return null
  commit([...list, u]); return u
}
export function updateUser(id, patch) {
  commit(list.map((u) => (u.id === id ? { ...u, ...patch, name: patch.name != null ? patch.name.trim() : u.name } : u)))
}
export function toggleUserActive(id) {
  commit(list.map((u) => (u.id === id ? { ...u, active: !u.active } : u)))
}
