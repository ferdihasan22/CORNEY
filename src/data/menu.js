// CORNEY dummy data (Fase 1) — replace with Supabase later.
// Source of truth for product model: PRD §6.3 + skill product table.

// 4 isian induk = the ONLY stock units (counted per-piece). Mix has its own stock.
export const PARENT_FILLINGS = [
  { id: 'mozza', name: 'Keju Mozza' },
  { id: 'sosis', name: 'Sosis Reguler' },
  { id: 'jumbo', name: 'Sosis Jumbo' },
  { id: 'mix', name: 'Mix' },
]

// Product photos — reused from the Stitch Walk-in reference
// (src/refrenceUI/UIrefrence/walk_in_sale_corney_pos/code.html) so the React UI
// matches the design. Mapped by closest visual: sweet=choc, mozza=cheese pull,
// potato=gamja, jumbo=sausage, mix=half-half.
const AIDA = 'https://lh3.googleusercontent.com/aida-public/'
const PHOTO = {
  sweet: AIDA + 'AB6AXuCVkTCnCaSDsi9xEZV-vOwYjs1ut1eLplmWyrhl5XWBgkfkIXspTNViv4vlkxA6edQrYvdm-5DWxIwOIztQBYdPCWt3rBnV7Kbwxg6E1NdwGSpM5XRGpUA0gscN58JtBBnmUCbYhwMRSl0gpvx0BQtntWT0Gsg2v5LCy7f4ecGiFuKhRXDcStomVHTGfddxamJrt9tkbnZRzjwIQGhN3amzjSxGKhqNlxLwe0-o7oiHMqgOgVGG8QR3jBE_0Qn8_rM-7RXmyl17H_U',
  mozza: AIDA + 'AB6AXuBSg9n7nRuqGjG_N-fL5ttlazx-cIesKZTfPHJw59kGyopOa8XmluMSDDhXPIkDmduqqL9G9cqQhTNf4oDqWQU1I0Dx1C1pX_H8sr5rnMpux-0QIsIt0Muox1Eyjb154ERDOdw_kXlE827lEAYhHoQ4xmy3EBPkq78TYbCAt2dBNmYeZXbWHxYWzRrZbNPV_zMqEss_b8u8X1fnVr4Krb-wX3c4p9s2w8FdFHhxWPBXvSyN5MTPzugFB47pfHhPDQFs-Ax2uUTvWMI',
  potato: AIDA + 'AB6AXuAC8L20-dXICgqHB1jm_pBkeYBfjbPWxGHUTRi-jX0Dd97UTWd9XVDQzTtcAmgL7nyMeFLM2jYwuXesoQqQc9qxsGKBDkK7smbJviZfIEpiHijJXOLHDxa2foWwGXRptgQvJ_XvB7LhvEPoP49weyFs1MSCI0UBjvJXl-DnMBJICExRBa7Lp0vrH-i8jm7G2HUGXMiVYCfejjD0YGD5QtZFIOL0djb_eHpXqXS6Ts2v6He7YegCi-GZMh-o74EzVrQwlLEm4dcutm4',
  jumbo: AIDA + 'AB6AXuAyoOCKAJ5TJFLz0Du6WOdA0g5gLzgyvc7HD3dnVxlYslGrhBGWU4HuwqSR0xFY49rCRBJCcDyi8H-MZsUpnklFlmGoPbDMMoYrVG9SrYmjgzYHxQWyO5tnBPKY1HH-5-9mMF2MzfhGvFXMKjrb0Acf05QF4TMiile08stYk9Jz0DTiKJAXbqAlJFpaWuJXtkVyjdv45nIaMXWrTa8ivkPfTRIbIJUPzljO6yVRA1XZdzVA2F4SILHj47-Y-MQZzz4xEhNR8GinIRc',
  mix: AIDA + 'AB6AXuBJ7zn99nAq_TmpTLqz0742U41bsLxU4iDlVlbrfSR0VYkLLPbD-dCDiVNLk2pLmWlzsYYXV8yOIauR6uRn1qgeOAxquk-5RKFLUT7Dr7rOYdGg-77MV6DtXaIF5_Ai6Vw2Sr58-lAFbJGfcQ8N7QbavPNBH2NjsLH9Q0MVED6MWqb2NYvNOB8BwRoiQ3qf5jE-31j2uJ6ZcPoRLGKAelOJt3CiMG3g57YoHMTapI7mpVKb8zaBFKrWZoCn0hQu5ZWU8MxBh7yy_qA',
}

// 11 menus → parent → category. Price per combination (not a formula).
// category: 'sweet' (glaze, NO sauce) | 'savory' (sauce, NO glaze).
export const MENUS = [
  { id: 'sweet_coklat', name: 'Sweet Coklat', parent: 'mozza', category: 'sweet', price: 17000, label: 'Best Seller', img: PHOTO.sweet },
  { id: 'sweet_tiramisu', name: 'Sweet Tiramisu', parent: 'mozza', category: 'sweet', price: 17000, img: PHOTO.sweet },
  { id: 'sweet_greentea', name: 'Sweet Greentea', parent: 'mozza', category: 'sweet', price: 17000, img: PHOTO.sweet },
  { id: 'mozza_ori', name: 'Mozza Ori', parent: 'mozza', category: 'savory', price: 17000, img: PHOTO.mozza },
  { id: 'mozza_kentang', name: 'Mozza Kentang', parent: 'mozza', category: 'savory', price: 20000, label: 'Pedas', img: PHOTO.potato },
  { id: 'sosis_ori', name: 'Sosis Ori', parent: 'sosis', category: 'savory', price: 15000, img: PHOTO.jumbo },
  { id: 'sosis_kentang', name: 'Sosis Kentang', parent: 'sosis', category: 'savory', price: 18000, img: PHOTO.potato },
  { id: 'jumbo_ori', name: 'Jumbo Ori', parent: 'jumbo', category: 'savory', price: 20000, img: PHOTO.jumbo },
  { id: 'jumbo_kentang', name: 'Jumbo Kentang', parent: 'jumbo', category: 'savory', price: 23000, img: PHOTO.potato },
  { id: 'mix_ori', name: 'Mix Ori', parent: 'mix', category: 'savory', price: 19000, img: PHOTO.mix },
  { id: 'mix_kentang', name: 'Mix Kentang', parent: 'mix', category: 'savory', price: 22000, img: PHOTO.mix },
]

// Sauces (savory only). free/paid per Owner setting; tanpa batas jumlah pilih.
export const SAUCES = [
  { id: 'tomat', name: 'Saus Tomat', price: 0 },
  { id: 'sambal', name: 'Saus Sambal', price: 0 },
  { id: 'keju', name: 'Saus Keju', price: 3000 },
  { id: 'mayo', name: 'Mayonaise', price: 3000 },
]
// (Batas jumlah saus dihapus — pelanggan/kasir bisa pilih semua saus tanpa batas.
//  Saus berbayar tetap menambah total.)

// Dummy branches (account = branch, PRD §6.1).
export const BRANCHES = [
  { id: 'sepinggan', name: 'CORNEY Sepinggan', username: 'corney-sepinggan', address: 'Jl. Marsma R. Iswahyudi, Balikpapan', wa: '6281200000001', maps: 'https://www.google.com/maps/search/?api=1&query=CORNEY+Sepinggan+Balikpapan', coord: '-1.2675,116.8945' },
  { id: 'gunungsari', name: 'CORNEY Gunung Sari', username: 'corney-gunungsari', address: 'Jl. Gunung Sari Ilir, Balikpapan', wa: '6281200000002', maps: 'https://www.google.com/maps/search/?api=1&query=CORNEY+Gunung+Sari+Balikpapan', coord: '-1.2479,116.8529' },
]

// Demo passwords (dummy only — real auth via Supabase later).
export const DEMO_PASSWORD = '123456'

// Owner WhatsApp (dummy) — target for wa.me click-to-chat (BHN-06 correction,
// shopping requests, etc.). PRD golden rule #9: WA = pre-typed wa.me, no API.
export const OWNER_WA = '6281200000000'

// "Sisa kemarin" per branch (parent filling → qty) — yesterday's remainder the
// system carries into Opening Day (OPN-01). Kasir counts physical against this;
// diff = susut (loss) reported to Owner.
export const DUMMY_STOCK = {
  sepinggan: { mozza: 40, sosis: 35, jumbo: 20, mix: 15 },
  gunungsari: { mozza: 30, sosis: 25, jumbo: 18, mix: 10 },
}

// "Stok standar" (par level) per branch — set by Owner (PWA Owner master data,
// OWN/OPS-01). Kasir sees the target; Opening badge compares today's stock vs
// this: above = Kelebihan, below = Kurang.
export const DUMMY_STANDARD_STOCK = {
  sepinggan: { mozza: 60, sosis: 50, jumbo: 30, mix: 25 },
  gunungsari: { mozza: 50, sosis: 40, jumbo: 25, mix: 20 },
}

// "Barang datang" — shipment Operasional input for today (OPN-01 way #1: kasir
// confirms it, recording any send-vs-receive diff). Way #2 (manual entry) is
// entered by the kasir on the screen and flagged "input manual".
export const DUMMY_SHIPMENT = {
  sepinggan: { mozza: 20, sosis: 15, jumbo: 10, mix: 5 },
  gunungsari: { mozza: 15, sosis: 12, jumbo: 8, mix: 4 },
}

export const LOW_STOCK_THRESHOLD = 5 // WLK-01 early warning (Owner-set)

// Dummy kasir daily wage — cap for payroll deduction (CLS-02b). Owner-set per
// branch in real. Deduction is capped at 100% of this (wage can hit Rp 0).
export const DUMMY_DAILY_WAGE = 340000

// Lowest selling price among variants of a parent filling (CLS-02b uses the
// LOWEST variant price for the deduction). Computed from MENUS.
export function lowestVariantPrice(parentId) {
  const prices = MENUS.filter((m) => m.parent === parentId).map((m) => m.price)
  return prices.length ? Math.min(...prices) : 0
}

export const fmtRp = (n) => 'Rp ' + (n ?? 0).toLocaleString('id-ID')

// Raw ingredients catalog (dummy, Fase 1) — building blocks for Resep/BOM
// (OWN-02). unitPrice is the estimated buy price per unit (HPP basis). Real
// prices flow from the supplier purchase ledger (OWN-08) in Fase 2.
export const INGREDIENTS = [
  { id: 'tepung', name: 'Tepung Adonan', sub: 'Premix Corney', unit: 'g', unitPrice: 80, icon: 'grain' },
  { id: 'keju', name: 'Keju Mozza Block', sub: 'Block cut', unit: 'pcs', unitPrice: 3000, icon: 'crop_square' },
  { id: 'sosis_reg', name: 'Sosis Reguler', sub: 'Standard', unit: 'pcs', unitPrice: 2500, icon: 'lunch_dining' },
  { id: 'sosis_jumbo', name: 'Sosis Jumbo', sub: 'Premium', unit: 'pcs', unitPrice: 4000, icon: 'lunch_dining' },
  { id: 'kentang', name: 'Kentang Coating', sub: 'Diced fry', unit: 'g', unitPrice: 50, icon: 'blur_circular' },
  { id: 'panir', name: 'Tepung Panir', sub: 'Fine crumb', unit: 'g', unitPrice: 30, icon: 'blur_on' },
  { id: 'minyak', name: 'Minyak Goreng', sub: 'Deep fry', unit: 'ml', unitPrice: 20, icon: 'opacity' },
  { id: 'tusuk', name: 'Tusuk Bambu', sub: '25 cm', unit: 'pcs', unitPrice: 150, icon: 'straighten' },
  { id: 'glaze', name: 'Glaze Sweet', sub: 'Coklat/Tiramisu/Greentea', unit: 'g', unitPrice: 100, icon: 'icecream' },
]

// Default BOM per menu (dummy) — base batter + parent core + variant extras.
// Stored editable in the master store; this just seeds first run.
export function defaultRecipe(menu) {
  const rows = [
    { ingredientId: 'tepung', qty: 30 },
    { ingredientId: 'panir', qty: 15 },
    { ingredientId: 'minyak', qty: 10 },
    { ingredientId: 'tusuk', qty: 1 },
  ]
  if (menu.parent === 'mozza') rows.push({ ingredientId: 'keju', qty: 1 })
  else if (menu.parent === 'sosis') rows.push({ ingredientId: 'sosis_reg', qty: 1 })
  else if (menu.parent === 'jumbo') rows.push({ ingredientId: 'sosis_jumbo', qty: 1 })
  else if (menu.parent === 'mix') rows.push({ ingredientId: 'keju', qty: 1 }, { ingredientId: 'sosis_reg', qty: 1 })
  if (menu.id.includes('kentang')) rows.push({ ingredientId: 'kentang', qty: 20 })
  if (menu.category === 'sweet') rows.push({ ingredientId: 'glaze', qty: 10 })
  return rows
}
