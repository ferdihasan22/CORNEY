// CORNEY — Pembentuk byte ESC/POS struk kasir (58mm = 32 kolom font A).
// Dipakai bersama oleh jalur cetak Web Bluetooth (btprinter.web.js) DAN native
// Capacitor (btprinter.native.js, via .raw()). Output identik → struk sama persis
// di kedua jalur. Tak ada I/O di sini, murni membentuk Uint8Array.

const W = 32
const enc = (s) => { const a = []; for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0xff); return a }
const lr = (l, r) => { l = String(l); r = String(r); const sp = Math.max(1, W - l.length - r.length); return l + ' '.repeat(sp) + r }
const fmt = (n) => 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
const METHOD = { tunai: 'Tunai', qris_midtrans: 'QRIS Midtrans', qris_gopay: 'QRIS GoPay', gofood: 'GoFood', grabfood: 'GrabFood' }

export function buildReceipt(sale, branch, menus, reprint = false) {
  const out = []
  const ESC = 0x1b, GS = 0x1d
  const p = (...b) => out.push(...b)
  const t = (s) => p(...enc(s))
  const nl = (n = 1) => { for (let i = 0; i < n; i++) p(0x0a) }
  const line = () => { t('-'.repeat(W)); nl() }
  const nameOf = (id) => (menus.find((m) => m.id === id)?.name) || id
  const baseOf = (l) => (l.price != null ? l.price : (menus.find((m) => m.id === l.menuId)?.price ?? 0))
  const dt = new Date(sale.ts)

  p(ESC, 0x40) // init
  p(ESC, 0x61, 0x01) // center
  p(GS, 0x21, 0x11); t('CORNEY'); p(GS, 0x21, 0x00); nl()
  p(ESC, 0x45, 1); t(branch.name); p(ESC, 0x45, 0); nl()
  if (branch.address) { t(branch.address.slice(0, W)); nl() }
  if (reprint) { t('-- CETAK ULANG --'); nl() }
  p(ESC, 0x61, 0x00) // left
  line()
  t(lr('No.', sale.id)); nl()
  t(lr('Tanggal', dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }))); nl()
  t(lr('Jam', dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))); nl()
  line()
  ;(sale.lines || []).forEach((l) => {
    t(lr(`${l.qty}x ${nameOf(l.menuId)}`.slice(0, W - 10), fmt(baseOf(l) * l.qty))); nl()
    ;(l.sauces || []).forEach((s) => { t('  + ' + (s.name || s.id)); nl() })
  })
  line()
  t(lr('Subtotal', fmt(sale.subtotal))); nl()
  if (sale.biaya > 0) { t(lr('Biaya Tambahan', fmt(sale.biaya))); nl() }
  p(ESC, 0x45, 1); t(lr('TOTAL', fmt(sale.total))); p(ESC, 0x45, 0); nl()
  line()
  if (sale.paid) {
    t(lr('Metode', METHOD[sale.method] || '-')); nl()
    if (sale.method === 'tunai') { t(lr('Tunai', fmt(sale.cashReceived))); nl(); t(lr('Kembalian', fmt(sale.change))); nl() }
  } else { t('** BELUM BAYAR **'); nl() }
  nl()
  p(ESC, 0x61, 0x01) // center
  t('#CeritanyaBersamaCorney'); nl()
  t('Komplain? IG @corney.idn'); nl()
  nl(3)
  p(GS, 0x56, 0x00) // potong kertas (jika didukung)
  return Uint8Array.from(out)
}

export function buildTestReceipt() {
  const out = []
  const ESC = 0x1b, GS = 0x1d
  out.push(ESC, 0x40, ESC, 0x61, 0x01)
  out.push(GS, 0x21, 0x11, ...enc('CORNEY'), GS, 0x21, 0x00, 0x0a)
  out.push(...enc('TEST PRINT OK'), 0x0a, ...enc('Printer thermal siap.'), 0x0a, 0x0a, 0x0a)
  out.push(GS, 0x56, 0x00)
  return Uint8Array.from(out)
}
