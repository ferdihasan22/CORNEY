// CORNEY — Loyalty store (CUS-05, Fase 2 dummy/local). One member per device
// (real per-account + OTP via Supabase TAHAP 4). Points per purchase; rewards
// validated kasir-side. Mandatory data consent before register (§10).
//
// Member: { wa, points, joinedAt, txns: [{ type:'earn'|'redeem', delta, label, at }] }

const KEY = 'corney_loyalty'
const subscribers = new Set()
let member = load()
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null } }
function commit(next) { member = next; if (next) localStorage.setItem(KEY, JSON.stringify(next)); else localStorage.removeItem(KEY); subscribers.forEach((fn) => fn()) }

export function getMember() { return member }
export function subscribeMember(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function registerMember(wa) {
  const clean = (wa || '').replace(/\D/g, '')
  if (clean.length < 8) return null
  // Welcome bonus so the dashboard isn't empty.
  const m = { wa: clean, points: 20, joinedAt: new Date().toISOString(), txns: [{ type: 'earn', delta: 20, label: 'Bonus gabung member', at: new Date().toISOString() }] }
  commit(m)
  return m
}
export function earnPoints(delta, label) {
  if (!member) return
  commit({ ...member, points: member.points + delta, txns: [{ type: 'earn', delta, label, at: new Date().toISOString() }, ...member.txns] })
}
export function redeemReward(cost, label) {
  if (!member || member.points < cost) return false
  commit({ ...member, points: member.points - cost, txns: [{ type: 'redeem', delta: -cost, label, at: new Date().toISOString() }, ...member.txns] })
  return true
}
