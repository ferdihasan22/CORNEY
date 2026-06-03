// CORNEY — Customer cart store (Fase 2, dummy/local). One cart belongs to ONE
// branch (prices/stock differ per branch). Persisted to localStorage so a
// refresh mid-order never loses items. Replace with server cart in TAHAP 4.
//
// Shape: { branchId, lines: [{ sig, menuId, sauces:[{id}], qty }], promoCode }

const KEY = 'corney_cart'
const subscribers = new Set()
let state = load()

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (!s || !Array.isArray(s.lines)) return null
    return s
  } catch {
    return null
  }
}
function commit(next) {
  state = next
  if (next) localStorage.setItem(KEY, JSON.stringify(next))
  else localStorage.removeItem(KEY)
  subscribers.forEach((fn) => fn())
}

export function getCart() {
  return state
}
export function subscribeCart(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

const sigOf = (menuId, sauces) => menuId + ':' + (sauces || []).map((s) => s.id).sort().join(',')

export function cartCount(branchId) {
  if (!state || (branchId && state.branchId !== branchId)) return 0
  return state.lines.reduce((s, l) => s + l.qty, 0)
}

// Add an item. If the cart belongs to a different branch, it resets to the new
// branch (a cart can't mix branches). Identical menu+sauce merges (qty +=).
export function addItem(branchId, menuId, sauces = [], qty = 1) {
  let base = state
  if (!base || base.branchId !== branchId) base = { branchId, lines: [], promoCode: '' }
  const sig = sigOf(menuId, sauces)
  const lines = base.lines.map((l) => ({ ...l }))
  const existing = lines.find((l) => l.sig === sig)
  if (existing) existing.qty += qty
  else lines.push({ sig, menuId, sauces, qty })
  commit({ ...base, lines })
}

export function incLine(sig) {
  if (!state) return
  commit({ ...state, lines: state.lines.map((l) => (l.sig === sig ? { ...l, qty: l.qty + 1 } : l)) })
}
export function decLine(sig) {
  if (!state) return
  const lines = state.lines.map((l) => (l.sig === sig ? { ...l, qty: l.qty - 1 } : l)).filter((l) => l.qty > 0)
  commit(lines.length ? { ...state, lines } : null)
}
export function removeLine(sig) {
  if (!state) return
  const lines = state.lines.filter((l) => l.sig !== sig)
  commit(lines.length ? { ...state, lines } : null)
}

// Replace the sauces on an existing line (cart "Ubah saus"). The sig changes with
// the sauce set; if the new sig collides with another line (same menu+sauce), the
// two merge (qty summed) so we never end up with duplicate identical lines.
export function updateLineSauces(sig, sauces) {
  if (!state) return
  const target = state.lines.find((l) => l.sig === sig)
  if (!target) return
  const newSig = sigOf(target.menuId, sauces)
  if (newSig === sig) {
    commit({ ...state, lines: state.lines.map((l) => (l.sig === sig ? { ...l, sauces } : l)) })
    return
  }
  const collide = state.lines.find((l) => l.sig === newSig)
  let lines
  if (collide) {
    lines = state.lines
      .filter((l) => l.sig !== sig)
      .map((l) => (l.sig === newSig ? { ...l, qty: l.qty + target.qty } : l))
  } else {
    lines = state.lines.map((l) => (l.sig === sig ? { ...l, sig: newSig, sauces } : l))
  }
  commit({ ...state, lines })
}
export function setPromoCode(code) {
  if (!state) return
  commit({ ...state, promoCode: (code || '').trim().toUpperCase() })
}
export function clearCart() {
  commit(null)
}
