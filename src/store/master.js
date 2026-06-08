// CORNEY — Master Data store (Fase 1, dummy/local). Owner-managed catalog that
// outlives a single kasir day: parent fillings (isian induk), menus/variants,
// recipes. Persisted to localStorage `corney_master`, seeded from src/data so
// the app works on first run. Replace with Supabase tables in TAHAP 4.
//
// PRD rule (golden #8): master data is NEVER hard-deleted — only deactivated —
// so historical transactions keep referring to a valid record. Every mutation
// assigns a NEW state object (immutable) for useSyncExternalStore.

import { PARENT_FILLINGS, MENUS, SAUCES, LOW_STOCK_THRESHOLD, INGREDIENTS, defaultRecipe, BRANCHES } from '../data/menu.js'
import { isSupabase } from '../lib/backend.js'
import { deleteImageByUrl } from '../lib/cloudinary.js'

const KEY = 'corney_master'

const subscribers = new Set()

// SUMBER TUNGGAL CABANG: master.branches adalah daftar cabang yang hidup (bisa
// ditambah/diedit/dinonaktifkan Owner). Konstanta BRANCHES (dipakai ~47 file lain
// — kasir, laporan, operasional, dll) disinkronkan IN-PLACE ke daftar ini supaya
// perubahan cabang otomatis berlaku di seluruh app tanpa membongkar tiap file.
function syncBranchesConst() {
  if (!Array.isArray(state?.branches)) return
  BRANCHES.length = 0
  state.branches.forEach((b) => BRANCHES.push(b))
}
// Sama seperti BRANCHES: SAUCES adalah const yang dipakai ~11 file (customer,
// kasir, owner) sebagai tabel lookup. Sinkron in-place dari master.sauces supaya
// data saus dari Supabase otomatis berlaku tanpa mengubah importer-nya.
function syncSaucesConst() {
  if (!Array.isArray(state?.sauces)) return
  SAUCES.length = 0
  state.sauces.forEach((s) => SAUCES.push(s))
}
let state = load()
syncBranchesConst()
syncSaucesConst()

// ── Hidrasi Supabase (TAHAP 4, FASE 1 "pindah baca") ────────────────────────
// localStorage di atas = cache sinkron (BRANCHES langsung terisi untuk ~47 file).
// Bila VITE_BACKEND=supabase, ambil config dari DB lalu timpa cache + notify.
// recipes BELUM dimigrasi → dipertahankan dari cache lokal. Gagal/offline →
// diam-diam tetap pakai cache (offline-first). CATATAN: ini baru jalur BACA;
// tulis (addMenu dll) masih ke localStorage sampai fase berikutnya.
export function refreshMaster() {
  if (!isSupabase()) return
  import('./master.remote.js')
    .then(({ fetchMasterFromSupabase }) => fetchMasterFromSupabase())
    .then((remote) => { commit({ ...state, ...remote, recipes: state.recipes }) })
    .catch((e) => console.warn('[master] hidrasi Supabase gagal, pakai cache lokal:', e?.message || e))
}
if (isSupabase()) refreshMaster()

// Realtime master: perubahan saus/menu/banner/dll oleh Owner (dari perangkat lain)
// langsung men-trigger refetch di SEMUA klien yang sedang terbuka — tanpa menunggu
// app dibuka/difokus ulang. Debounce 400ms agar banyak baris berubah = 1 fetch.
if (typeof window !== 'undefined' && isSupabase()) {
  import('./master.remote.js').then(({ subscribeMasterRealtime }) => {
    let t = null
    subscribeMasterRealtime(() => {
      if (t) clearTimeout(t)
      t = setTimeout(refreshMaster, 400)
    })
  }).catch((e) => console.warn('[master] realtime gagal dipasang:', e?.message || e))
}

// #2 Gambar/menu terbaru "langsung": segarkan master saat tab KEMBALI aktif (mis.
// owner ganti banner → customer buka lagi app → lihat banner baru tanpa reload).
// Throttle 10 dtk supaya tak refetch beruntun; tak ada poll terus-menerus (hemat).
if (typeof window !== 'undefined' && isSupabase()) {
  let _lastRefresh = 0
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return
    const t = Date.now()
    if (t - _lastRefresh < 10000) return
    _lastRefresh = t
    refreshMaster()
  })
}

// Dorong perubahan master ke Supabase (mode supabase) via modul tulis terpisah.
// Dynamic import → klien Supabase tak masuk bundle mode local. Fire-and-forget;
// localStorage sudah jadi cache. Entitas lain (parents/branches/promos/banners/
// override) menyusul pola sama.
function remoteWrite(fn) {
  if (!isSupabase()) return
  import('./master.write.js').then(fn).catch((e) => console.warn('[master] modul tulis gagal dimuat:', e?.message || e))
}

function seed() {
  return {
    // Isian induk — the only stock units. threshold = per-parent low-stock
    // warning (WLK-01); active=false hides it from daily ops without deleting.
    parents: PARENT_FILLINGS.map((p) => ({
      id: p.id,
      name: p.name,
      active: true,
      threshold: LOW_STOCK_THRESHOLD,
    })),
    // Menus/variants (OWN-02 2-4). Each links 1:1 to a parent filling and has a
    // category that enforces the topping rule: sweet = glaze, NO sauce.
    menus: MENUS.map((m) => ({
      id: m.id,
      name: m.name,
      parent: m.parent,
      category: m.category, // 'sweet' | 'savory'
      price: m.price,
      label: m.label || '',
      img: m.img || '',
      active: true,
    })),
    // Recipes / BOM (OWN-02) — menuId → [{ingredientId, qty}]. Seeded from the
    // dummy default builder; editable per menu in the Resep/BOM screen.
    recipes: Object.fromEntries(MENUS.map((m) => [m.id, defaultRecipe(m)])),
    // Sauces (savory) — di-seed dari data statik; owner-editable menyusul.
    sauces: SAUCES.map((s) => ({ id: s.id, name: s.name, price: s.price })),
    // Branches / outlets (§3 multi-cabang). Owner-managed; account = branch.
    // stopOnline = stop accepting online orders; closeBooth = booth closes.
    branches: BRANCHES.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      wa: b.wa,
      maps: b.maps || '',
      username: b.username,
      // Nama titik penjemputan yang diketik customer di aplikasi Maxim.
      maximName: b.name.replace('CORNEY', 'Corney'),
      // Standar uang kembalian (modal awal laci) — default Buka Kas kasir.
      kembalian: 200000,
      active: true,
      stopOnline: '21:30',
      closeBooth: '22:00',
    })),
    // Banners (CUS-06 / OWN-09) — carousel on the customer home. Global (same
    // all branches), manual on/off, array order = display order. img reuses menu
    // photos as dummy artwork.
    banners: [
      { id: 'BNR-1', title: 'Keju Meleleh, Cuma Rp 17k', img: MENUS.find((m) => m.id === 'mozza_ori')?.img || '', active: true },
      { id: 'BNR-2', title: 'Menu Baru: Sweet Greentea', img: MENUS.find((m) => m.id === 'sweet_greentea')?.img || '', active: true },
      { id: 'BNR-3', title: 'Promo Weekend Seru', img: MENUS.find((m) => m.id === 'jumbo_kentang')?.img || '', active: false },
    ],
    // Promos (OWN-10) — Owner-only; kasir applies, never invents. Types:
    // diskon (%/nominal), voucher (code+quota), beli_dapat (BxGy, free item =
    // no wage cut), happy_hour (time window). Safeguards: noCombine + capMax.
    promos: [
      { id: 'PRM-merdeka', name: 'Diskon Merdeka', type: 'diskon', discountKind: 'percent', value: 20, target: 'all', noCombine: true, capMax: 50000, active: true },
      { id: 'PRM-pesta', name: 'Pesta Sosis', type: 'beli_dapat', buyQty: 2, getQty: 1, target: 'savory', noCombine: true, capMax: 0, active: true },
      { id: 'PRM-sore', name: 'Sore Mantap', type: 'happy_hour', discountKind: 'percent', value: 15, startTime: '15:00', endTime: '17:00', target: 'all', noCombine: false, capMax: 0, active: true },
      { id: 'PRM-gajian', name: 'Gajian Hemat', type: 'voucher', discountKind: 'nominal', value: 5000, code: 'HEMAT5K', quota: 100, target: 'all', noCombine: true, capMax: 0, active: false },
    ],
    // Per-branch menu overrides (§2.3 / BranchProduct): { [branchId]: { [menuId]:
    // { price, off } } }. price = local price (null = pakai harga master); off =
    // sembunyikan menu di cabang itu. Owner-managed.
    branchOverrides: {},
    // Per-branch SAUCE overrides: { [branchId]: { [sauceId]: { price, off } } }.
    // price null = pakai harga global; off true = saus tak ditawarkan di cabang itu.
    branchSauceOverrides: {},
    // Gambar CARD di landing Customer (hero linktree) — TERPISAH dari banner
    // katalog. Owner-managed; { id, title, img, active }. Kosong → fallback.
    landingCards: [],
  }
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (!s || !Array.isArray(s.parents)) return seed()
    // Migrate older master snapshots that predate newer sections.
    const fresh = seed()
    if (!Array.isArray(s.menus)) s.menus = fresh.menus
    if (!s.recipes || typeof s.recipes !== 'object') s.recipes = fresh.recipes
    if (!Array.isArray(s.branches)) s.branches = fresh.branches
    if (!Array.isArray(s.promos)) s.promos = fresh.promos
    if (!Array.isArray(s.banners)) s.banners = fresh.banners
    if (!s.branchOverrides || typeof s.branchOverrides !== 'object') s.branchOverrides = fresh.branchOverrides
    if (!s.branchSauceOverrides || typeof s.branchSauceOverrides !== 'object') s.branchSauceOverrides = fresh.branchSauceOverrides
    if (!Array.isArray(s.landingCards)) s.landingCards = fresh.landingCards
    if (!Array.isArray(s.sauces)) s.sauces = fresh.sauces
    return s
  } catch {
    return seed()
  }
}

function commit(next) {
  state = next
  localStorage.setItem(KEY, JSON.stringify(state))
  syncBranchesConst() // jaga BRANCHES tetap = daftar cabang terbaru
  syncSaucesConst()   // jaga SAUCES tetap = daftar saus terbaru
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); syncBranchesConst(); syncSaucesConst(); subscribers.forEach((fn) => fn()) } })
}

export function getMaster() {
  return state
}
export function subscribeMaster(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

// How many menus reference this parent, from the live master catalog.
export function linkedMenuCount(parentId) {
  return (state?.menus || []).filter((m) => m.parent === parentId).length
}

// OW-02 (1) — add a new isian induk. id derived from name (kebab), kept unique.
export function addParent({ name, threshold, active = true }) {
  if (!state) return null
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'isian'
  let id = base
  let n = 2
  while (state.parents.some((p) => p.id === id)) id = `${base}-${n++}`
  const parent = { id, name: name.trim(), active, threshold: Math.max(0, Number(threshold) || 0) }
  commit({ ...state, parents: [...state.parents, parent] })
  remoteWrite((w) => w.pushParent(parent))
  return parent
}

// Edit name / threshold (id is stable — never changes once referenced).
export function updateParent(id, { name, threshold }) {
  if (!state) return null
  let found = null
  const parents = state.parents.map((p) => {
    if (p.id !== id) return p
    found = {
      ...p,
      ...(name != null ? { name: name.trim() } : {}),
      ...(threshold != null ? { threshold: Math.max(0, Number(threshold) || 0) } : {}),
    }
    return found
  })
  if (!found) return null
  commit({ ...state, parents })
  remoteWrite((w) => w.pushParent(found))
  return found
}

// Deactivate ≠ delete (PRD #8). Toggle visibility in daily ops; data is kept.
export function toggleParentActive(id) {
  if (!state) return null
  let found = null
  const parents = state.parents.map((p) => {
    if (p.id !== id) return p
    found = { ...p, active: !p.active }
    return found
  })
  if (!found) return null
  commit({ ...state, parents })
  remoteWrite((w) => w.pushParent(found))
  return found
}

// Active parents only — used to populate the menu's 1:1 parent dropdown.
export function activeParents() {
  return (state?.parents || []).filter((p) => p.active)
}
export function parentNameById(id) {
  return (state?.parents || []).find((p) => p.id === id)?.name ?? id
}

// ── Menus / variants (OWN-02 2-4) ───────────────────────
// Sweet enforces the topping rule downstream (WalkinSale hides the sauce modal
// for sweet). category is stored here as the single source of that rule.
function normMenu({ name, parent, category, price, label, img, desc, active = true }) {
  return {
    name: (name || '').trim(),
    parent,
    category: category === 'sweet' ? 'sweet' : 'savory',
    price: Math.max(0, Math.round(Number(price) || 0)),
    label: (label || '').trim(),
    img: (img || '').trim(),
    desc: (desc || '').trim(),
    active,
  }
}

export function addMenu(data) {
  if (!state) return null
  const m = normMenu(data)
  if (!m.name || !m.parent) return null
  const base = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'menu'
  let id = base
  let n = 2
  while (state.menus.some((x) => x.id === id)) id = `${base}_${n++}`
  const menu = { id, ...m }
  commit({ ...state, menus: [...state.menus, menu] })
  remoteWrite((w) => w.pushMenu(menu))
  return menu
}

export function updateMenu(id, data) {
  if (!state) return null
  let found = null, oldImg = null
  const menus = state.menus.map((x) => {
    if (x.id !== id) return x
    oldImg = x.img
    const patch = {}
    if (data.name != null) patch.name = data.name.trim()
    if (data.parent != null) patch.parent = data.parent
    if (data.category != null) patch.category = data.category === 'sweet' ? 'sweet' : 'savory'
    if (data.price != null) patch.price = Math.max(0, Math.round(Number(data.price) || 0))
    if (data.label != null) patch.label = data.label.trim()
    if (data.img != null) patch.img = data.img.trim()
    if (data.desc != null) patch.desc = data.desc.trim()
    found = { ...x, ...patch }
    return found
  })
  if (!found) return null
  commit({ ...state, menus })
  remoteWrite((w) => w.pushMenu(found))
  if (oldImg && oldImg !== found.img) deleteImageByUrl(oldImg) // anti-sampah: hapus gambar lama
  return found
}

export function toggleMenuActive(id) {
  if (!state) return null
  let found = null
  const menus = state.menus.map((x) => {
    if (x.id !== id) return x
    found = { ...x, active: !x.active }
    return found
  })
  if (!found) return null
  commit({ ...state, menus })
  remoteWrite((w) => w.pushMenu(found))
  return found
}

// How many active menus link to a parent (for the Isian Induk "menu tertaut").
export function menusByParent(parentId) {
  return (state?.menus || []).filter((m) => m.parent === parentId)
}

// ── Recipes / BOM (OWN-02) ──────────────────────────────
export function ingredientById(id) {
  return INGREDIENTS.find((i) => i.id === id) || null
}
export function getRecipe(menuId) {
  return (state?.recipes?.[menuId] || []).map((r) => ({ ...r }))
}

// Estimated HPP (cost of goods) for a menu = Σ qty × ingredient unit price.
export function recipeHpp(rows) {
  return (rows || []).reduce((sum, r) => {
    const ing = ingredientById(r.ingredientId)
    return sum + (ing ? ing.unitPrice * (Number(r.qty) || 0) : 0)
  }, 0)
}

// Save a menu's BOM (replaces the whole row set). Drops empty/invalid rows.
export function saveRecipe(menuId, rows) {
  if (!state) return null
  const clean = (rows || [])
    .filter((r) => r.ingredientId && ingredientById(r.ingredientId))
    .map((r) => ({ ingredientId: r.ingredientId, qty: Math.max(0, Number(r.qty) || 0) }))
  const recipes = { ...state.recipes, [menuId]: clean }
  commit({ ...state, recipes })
  return clean
}

// ── Branches / outlets (§3) ─────────────────────────────
function normBranch({ name, address, wa, maps, coord, qrisImg, maximName, kembalian, stopOnline, closeBooth, username, password, maximEnabled = true, active = true }) {
  const nm = (name || '').trim()
  return {
    name: nm,
    address: (address || '').trim(),
    wa: (wa || '').trim(),
    maps: (maps || '').trim(), // link Google Maps lokasi cabang
    coord: (coord || '').trim(), // "lat,lng" untuk cabang terdekat (customer)
    qrisImg: (qrisImg || '').trim(), // gambar QRIS GoPay (statis) per cabang
    // Default ke nama cabang bila kosong, supaya tutorial Maxim tetap terisi.
    maximName: (maximName || '').trim() || nm.replace('CORNEY', 'Corney'),
    kembalian: Math.max(0, Math.round(Number(kembalian) || 0)),
    stopOnline: stopOnline || '21:30',
    closeBooth: closeBooth || '22:00',
    username: (username || '').trim().toLowerCase(), // login cabang (kasir)
    password: (password == null ? '' : String(password)).trim(), // Fase 2 lokal; aman penuh di TAHAP 4
    maximEnabled: maximEnabled !== false, // opsi Maxim/Ojek di checkout (default aktif)
    active,
  }
}

export function addBranch(data) {
  if (!state) return null
  const b = normBranch(data)
  if (!b.name) return null
  const base = b.name.toLowerCase().replace('corney', '').replace(/[^a-z0-9]+/g, '').trim() || 'cabang'
  let id = base
  let n = 2
  while (state.branches.some((x) => x.id === id)) id = `${base}${n++}`
  // username: pakai isian Owner; kalau kosong, default corney-<id>.
  const branch = { ...b, id, username: b.username || `corney-${id}` }
  commit({ ...state, branches: [...state.branches, branch] })
  remoteWrite((w) => w.pushBranch(branch))
  return branch
}

// Hapus cabang (permanen) — entitas + konfig operasional. Data laporan historis
// TIDAK ikut terhapus (lihat removeBranch di master.write). Akun kasir Auth dihapus
// terpisah oleh pemanggil (adminDeleteKasir) di mode Supabase.
export function deleteBranch(id) {
  if (!state) return false
  if (!state.branches.some((x) => x.id === id)) return false
  commit({ ...state, branches: state.branches.filter((x) => x.id !== id) })
  remoteWrite((w) => w.removeBranch(id))
  return true
}

export function updateBranch(id, data) {
  if (!state) return null
  let found = null
  const branches = state.branches.map((x) => {
    if (x.id !== id) return x
    const patch = {}
    for (const k of ['name', 'address', 'wa', 'maps', 'coord', 'qrisImg', 'maximName', 'kembalian', 'stopOnline', 'closeBooth', 'username', 'password', 'maximEnabled']) {
      if (data[k] != null) patch[k] = typeof data[k] === 'string' ? data[k].trim() : data[k]
    }
    if (patch.username != null) patch.username = patch.username.toLowerCase() // username login selalu huruf kecil
    found = { ...x, ...patch }
    return found
  })
  if (!found) return null
  commit({ ...state, branches })
  remoteWrite((w) => w.pushBranch(found))
  return found
}

// Deactivate ≠ delete (PRD #8) — hides the outlet from ops; history stays.
export function toggleBranchActive(id) {
  if (!state) return null
  let found = null
  const branches = state.branches.map((x) => {
    if (x.id !== id) return x
    found = { ...x, active: !x.active }
    return found
  })
  if (!found) return null
  commit({ ...state, branches })
  remoteWrite((w) => w.pushBranch(found))
  return found
}

// ── Per-branch menu overrides (§2.3 BranchProduct) ──────────
// patch: { price?: number|null, off?: boolean }. price null/empty = pakai master.
export function setBranchOverride(branchId, menuId, patch) {
  if (!state) return
  const all = state.branchOverrides || {}
  const branch = { ...(all[branchId] || {}) }
  const cur = { ...(branch[menuId] || {}) }
  if ('price' in patch) cur.price = patch.price === '' || patch.price == null ? null : Math.max(0, Math.round(Number(patch.price) || 0))
  if ('off' in patch) cur.off = !!patch.off
  if ((cur.price == null) && !cur.off) delete branch[menuId]
  else branch[menuId] = cur
  commit({ ...state, branchOverrides: { ...all, [branchId]: branch } })
  remoteWrite((w) => w.pushOverride(branchId, menuId, branch[menuId]))
}

// Resolve a menu's effective price & visibility for a given branch.
export function menuForBranch(branchId, menu) {
  const ov = ((state?.branchOverrides || {})[branchId] || {})[menu.id]
  if (!ov) return { ...menu, off: false }
  return { ...menu, price: ov.price != null ? ov.price : menu.price, off: !!ov.off }
}

// ── Promos (OWN-10) ─────────────────────────────────────
function normPromo(d) {
  const type = ['diskon', 'voucher', 'beli_dapat', 'happy_hour'].includes(d.type) ? d.type : 'diskon'
  return {
    name: (d.name || '').trim(),
    type,
    discountKind: d.discountKind === 'nominal' ? 'nominal' : 'percent',
    value: Math.max(0, Number(d.value) || 0),
    buyQty: Math.max(1, Number(d.buyQty) || 2),
    getQty: Math.max(1, Number(d.getQty) || 1),
    startTime: d.startTime || '15:00',
    endTime: d.endTime || '17:00',
    code: (d.code || '').trim().toUpperCase(),
    quota: Math.max(0, Number(d.quota) || 0),
    target: d.target || 'all',
    noCombine: !!d.noCombine,
    capMax: Math.max(0, Number(d.capMax) || 0),
    active: d.active !== false,
  }
}

export function addPromo(d) {
  if (!state) return null
  const p = normPromo(d)
  if (!p.name) return null
  let id = 'PRM-' + (p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'promo')
  let n = 2
  while (state.promos.some((x) => x.id === id)) id = `${id}-${n++}`
  const promo = { id, ...p }
  commit({ ...state, promos: [promo, ...state.promos] })
  remoteWrite((w) => w.pushPromo(promo))
  return promo
}

export function updatePromo(id, d) {
  if (!state) return null
  let found = null
  const promos = state.promos.map((x) => {
    if (x.id !== id) return x
    found = { ...x, ...normPromo({ ...x, ...d }) }
    return found
  })
  if (!found) return null
  commit({ ...state, promos })
  remoteWrite((w) => w.pushPromo(found))
  return found
}

// Pause / resume (kept, not deleted — usage stays auditable).
export function togglePromoActive(id) {
  if (!state) return null
  let found = null
  const promos = state.promos.map((x) => {
    if (x.id !== id) return x
    found = { ...x, active: !x.active }
    return found
  })
  if (!found) return null
  commit({ ...state, promos })
  remoteWrite((w) => w.pushPromo(found))
  return found
}

// ── Banners (CUS-06 / OWN-09) ───────────────────────────
// Active banners in array order = the customer-home carousel.
export function activeBanners() {
  return (state?.banners || []).filter((b) => b.active)
}

export function addBanner({ title, img, active = true }) {
  if (!state) return null
  const t = (title || '').trim()
  const im = (img || '').trim()
  if (!im) return null // WAJIB gambar; judul OPSIONAL (boleh banyak banner tanpa judul)
  const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'banner'
  let id = 'BNR-' + slug
  let n = 2
  while (state.banners.some((x) => x.id === id)) id = `BNR-${slug}-${n++}`
  const banner = { id, title: t, img: im, active }
  const next = [...state.banners, banner] // pakai array baru EKSPLISIT (anti stale state)
  commit({ ...state, banners: next })
  remoteWrite((w) => w.pushBanners(next))
  return banner
}

export function updateBanner(id, { title, img }) {
  if (!state) return null
  let found = null, oldImg = null
  const banners = state.banners.map((x) => {
    if (x.id !== id) return x
    oldImg = x.img
    found = { ...x, ...(title != null ? { title: title.trim() } : {}), ...(img != null ? { img: img.trim() } : {}) }
    return found
  })
  if (!found) return null
  commit({ ...state, banners })
  remoteWrite((w) => w.pushBanners(state.banners))
  if (oldImg && oldImg !== found.img) deleteImageByUrl(oldImg) // anti-sampah
  return found
}

export function toggleBannerActive(id) {
  if (!state) return null
  let found = null
  const banners = state.banners.map((x) => {
    if (x.id !== id) return x
    found = { ...x, active: !x.active }
    return found
  })
  if (!found) return null
  commit({ ...state, banners })
  remoteWrite((w) => w.pushBanners(state.banners))
  return found
}

// Banners aren't transaction-historical → safe to delete outright.
export function deleteBanner(id) {
  if (!state) return null
  const old = state.banners.find((x) => x.id === id)
  commit({ ...state, banners: state.banners.filter((x) => x.id !== id) })
  remoteWrite((w) => w.removeBanner(id))
  if (old?.img) deleteImageByUrl(old.img) // anti-sampah: hapus gambar banner yang dihapus
}

// Reorder (display order) — move one slot up/down (drag-free).
export function moveBanner(id, dir) {
  if (!state) return null
  const arr = [...state.banners]
  const i = arr.findIndex((x) => x.id === id)
  const j = i + (dir === 'up' ? -1 : 1)
  if (i < 0 || j < 0 || j >= arr.length) return null
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  commit({ ...state, banners: arr })
  remoteWrite((w) => w.pushBanners(arr))
}

// ── Sauces (savory toppings) — Owner-managed, harga global per saus ──────────
// SAUCES (const yg dipakai customer & kasir) disinkron in-place dari state.sauces
// (lihat syncSaucesConst). Edit di sini → otomatis berlaku di seluruh app saat
// master di-refresh (buka app / tab kembali aktif) tanpa reinstall.
function normSauce({ name, price }) {
  return { name: (name || '').trim(), price: Math.max(0, Math.round(Number(price) || 0)) }
}

export function addSauce(data) {
  if (!state) return null
  const s = normSauce(data)
  if (!s.name) return null
  const base = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'saus'
  let id = base
  let n = 2
  while ((state.sauces || []).some((x) => x.id === id)) id = `${base}_${n++}`
  const sauce = { id, ...s }
  commit({ ...state, sauces: [...(state.sauces || []), sauce] })
  remoteWrite((w) => w.pushSauce(sauce))
  return sauce
}

export function updateSauce(id, data) {
  if (!state) return null
  let found = null
  const sauces = (state.sauces || []).map((x) => {
    if (x.id !== id) return x
    const patch = {}
    if (data.name != null) patch.name = data.name.trim()
    if (data.price != null) patch.price = Math.max(0, Math.round(Number(data.price) || 0))
    found = { ...x, ...patch }
    return found
  })
  if (!found) return null
  commit({ ...state, sauces })
  remoteWrite((w) => w.pushSauce(found))
  return found
}

// Saus tak menyimpan histori transaksi langsung (order menyimpan SNAPSHOT nama
// saus) → aman dihapus permanen seperti banner. (Menu/isian tetap dinonaktifkan.)
export function deleteSauce(id) {
  if (!state) return null
  commit({ ...state, sauces: (state.sauces || []).filter((x) => x.id !== id) })
  remoteWrite((w) => w.removeSauce(id))
}

// ── Override saus PER CABANG (Owner) ─────────────────────
// patch: { price?: number|null, off?: boolean }. price '' / null = pakai global.
export function setSauceOverride(branchId, sauceId, patch) {
  if (!state || !branchId || !sauceId) return
  const all = state.branchSauceOverrides || {}
  const branch = { ...(all[branchId] || {}) }
  const cur = { ...(branch[sauceId] || {}) }
  if ('price' in patch) cur.price = patch.price === '' || patch.price == null ? null : Math.max(0, Math.round(Number(patch.price) || 0))
  if ('off' in patch) cur.off = !!patch.off
  if ((cur.price == null) && !cur.off) delete branch[sauceId] // tak ada override → hapus baris
  else branch[sauceId] = cur
  commit({ ...state, branchSauceOverrides: { ...all, [branchId]: branch } })
  remoteWrite((w) => w.pushSauceOverride(branchId, sauceId, branch[sauceId]))
}

// Resolusi saus efektif untuk satu cabang. `sauceOffList` = saus yang ditandai
// HABIS kasir hari ini (dari branch_status.availability.sauceOff). Mengembalikan
// [{id,name,price,ownerOff,habis}] — caller sembunyikan ownerOff & disable habis.
// Pure: terima `master` (dari useMaster) agar reaktif di komponen.
export function resolveSaucesForBranch(master, branchId, sauceOffList = []) {
  const sauces = (master && master.sauces) || []
  const ov = ((master && master.branchSauceOverrides) || {})[branchId] || {}
  const offSet = new Set(sauceOffList || [])
  return sauces.map((s) => {
    const o = ov[s.id] || {}
    return {
      id: s.id,
      name: s.name,
      price: o.price != null ? o.price : (s.price ?? 0),
      ownerOff: !!o.off,
      habis: offSet.has(s.id),
    }
  })
}

// ── Gambar CARD landing Customer (hero) — TERPISAH dari banner katalog ────────
// Pola sama banners (full-sync ke server). { id, title, img, active }.
export function activeLandingCards() {
  return (state?.landingCards || []).filter((c) => c.active && c.img)
}
export function addLandingCard({ title, img, active = true }) {
  if (!state) return null
  const t = (title || '').trim()
  let id = 'LND-' + (t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'card')
  let n = 2
  while ((state.landingCards || []).some((x) => x.id === id)) id = `${id}-${n++}`
  const card = { id, title: t, img: (img || '').trim(), active }
  commit({ ...state, landingCards: [...(state.landingCards || []), card] })
  remoteWrite((w) => w.pushLandingCards(state.landingCards))
  return card
}
export function updateLandingCard(id, { title, img }) {
  if (!state) return null
  let found = null, oldImg = null
  const landingCards = (state.landingCards || []).map((x) => {
    if (x.id !== id) return x
    oldImg = x.img
    found = { ...x, ...(title != null ? { title: title.trim() } : {}), ...(img != null ? { img: img.trim() } : {}) }
    return found
  })
  if (!found) return null
  commit({ ...state, landingCards })
  remoteWrite((w) => w.pushLandingCards(state.landingCards))
  if (oldImg && oldImg !== found.img) deleteImageByUrl(oldImg)
  return found
}
export function toggleLandingCardActive(id) {
  if (!state) return null
  let found = null
  const landingCards = (state.landingCards || []).map((x) => {
    if (x.id !== id) return x
    found = { ...x, active: !x.active }
    return found
  })
  if (!found) return null
  commit({ ...state, landingCards })
  remoteWrite((w) => w.pushLandingCards(state.landingCards))
  return found
}
export function deleteLandingCard(id) {
  if (!state) return null
  const old = (state.landingCards || []).find((x) => x.id === id)
  commit({ ...state, landingCards: (state.landingCards || []).filter((x) => x.id !== id) })
  remoteWrite((w) => w.removeLandingCard(id))
  if (old?.img) deleteImageByUrl(old.img)
}
export function moveLandingCard(id, dir) {
  if (!state) return null
  const arr = [...(state.landingCards || [])]
  const i = arr.findIndex((x) => x.id === id)
  const j = i + (dir === 'up' ? -1 : 1)
  if (i < 0 || j < 0 || j >= arr.length) return null
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  commit({ ...state, landingCards: arr })
  remoteWrite((w) => w.pushLandingCards(arr))
}
