// CORNEY — Printer thermal via Web Bluetooth (BLE). HANYA jalan di Android Chrome
// (HTTPS) & printer yang mendukung BLE (bukan Bluetooth Classic/SPP). Mengirim
// ESC/POS ke characteristic yang writable. Banyak printer thermal murah hanya
// Classic → tak akan muncul di pemilih Web Bluetooth (pakai RawBT untuk itu).
const subscribers = new Set()
let device = null
let characteristic = null
let manualDisconnect = false // true bila user sengaja putuskan (jangan auto-reconnect)
let reconnecting = false
const LAST_ID_KEY = 'corney_bt_printer_id'

// Service UUID umum pada printer thermal/serial-BLE (coba semua).
const SERVICES = [
  0x18f0, 0xff00, 0xffe0, 0xff80,
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip/ISSC
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // beberapa printer
  '0000ff00-0000-1000-8000-00805f9b34fb',
]

export function btSupported() { return typeof navigator !== 'undefined' && !!navigator.bluetooth }
export function btConnected() { return !!(device && device.gatt && device.gatt.connected && characteristic) }
export function btDeviceName() { return device?.name || '' }
export function subscribeBt(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }
function notify() { subscribers.forEach((fn) => fn()) }

// Cari characteristic yang bisa ditulis (jalur kirim ESC/POS).
async function bindChar(server) {
  let services = []
  try { services = await server.getPrimaryServices() } catch { services = [] }
  for (const svc of services) {
    let chars = []
    try { chars = await svc.getCharacteristics() } catch { chars = [] }
    for (const c of chars) { if (c.properties.write || c.properties.writeWithoutResponse) return c }
  }
  return null
}

function onDisconnected() {
  characteristic = null
  notify()
  if (!manualDisconnect) scheduleReconnect() // auto-reconnect bila putus tak disengaja
}

// Coba sambung ulang ke device yang SAMA beberapa kali (printer tidur/jauh).
async function scheduleReconnect() {
  if (reconnecting || !device || manualDisconnect) return
  reconnecting = true
  for (let attempt = 1; attempt <= 6 && !manualDisconnect && device; attempt++) {
    await new Promise((r) => setTimeout(r, Math.min(8000, attempt * 1500)))
    if (manualDisconnect || !device) break
    try {
      const server = await device.gatt.connect()
      const c = await bindChar(server)
      if (c) { characteristic = c; notify(); break }
    } catch { /* coba lagi */ }
  }
  reconnecting = false
}

export async function btConnect() {
  if (!btSupported()) throw new Error('Browser ini tidak mendukung Web Bluetooth (pakai Android Chrome).')
  manualDisconnect = false
  device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES })
  device.addEventListener('gattserverdisconnected', onDisconnected)
  const server = await device.gatt.connect()
  characteristic = await bindChar(server)
  if (!characteristic) { try { device.gatt.disconnect() } catch { /* noop */ } throw new Error('Printer terkoneksi tapi tidak punya jalur tulis (kemungkinan bukan printer BLE ESC/POS).') }
  try { localStorage.setItem(LAST_ID_KEY, device.id) } catch { /* noop */ }
  notify()
  return device.name || 'Printer'
}

// Reconnect TANPA dialog setelah reload — ke printer terakhir yang sudah diizinkan.
export async function btAutoReconnect() {
  if (!btSupported() || !navigator.bluetooth.getDevices) return false
  let id = ''
  try { id = localStorage.getItem(LAST_ID_KEY) || '' } catch { /* noop */ }
  if (!id || btConnected()) return false
  try {
    const devs = await navigator.bluetooth.getDevices()
    const dev = devs.find((d) => d.id === id)
    if (!dev) return false
    device = dev
    manualDisconnect = false
    dev.addEventListener('gattserverdisconnected', onDisconnected)
    const server = await dev.gatt.connect()
    characteristic = await bindChar(server)
    notify()
    return btConnected()
  } catch { return false }
}

export function btDisconnect() {
  manualDisconnect = true
  try { device?.gatt?.disconnect() } catch { /* noop */ }
  characteristic = null
  notify()
}

// Kirim byte ke printer, dipotong kecil (BLE MTU terbatas).
async function write(bytes) {
  if (!btConnected()) throw new Error('Printer belum terhubung.')
  const chunk = 180
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.slice(i, i + chunk)
    if (characteristic.properties.writeWithoutResponse) await characteristic.writeValueWithoutResponse(slice)
    else await characteristic.writeValue(slice)
    await new Promise((r) => setTimeout(r, 18))
  }
}

// ── ESC/POS builder (58mm = 32 kolom font A) ──────────────
const W = 32
const enc = (s) => { const a = []; for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0xff); return a }
const lr = (l, r) => { l = String(l); r = String(r); const sp = Math.max(1, W - l.length - r.length); return l + ' '.repeat(sp) + r }
const fmt = (n) => 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
const METHOD = { tunai: 'Tunai', qris_midtrans: 'QRIS Midtrans', qris_gopay: 'QRIS GoPay', gofood: 'GoFood', grabfood: 'GrabFood' }

function buildReceipt(sale, branch, menus, reprint) {
  const out = []
  const ESC = 0x1b, GS = 0x1d
  const p = (...b) => out.push(...b)
  const t = (s) => p(...enc(s))
  const nl = (n = 1) => { for (let i = 0; i < n; i++) p(0x0a) }
  const line = () => { t('-'.repeat(W)); nl() }
  const nameOf = (id) => (menus.find((m) => m.id === id)?.name) || id
  const baseOf = (l) => menus.find((m) => m.id === l.menuId)?.price ?? 0
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

export async function btPrintReceipt(sale, branch, menus, reprint = false) {
  await write(buildReceipt(sale, branch, menus, reprint))
}

export async function btTestPrint() {
  const out = []
  const ESC = 0x1b, GS = 0x1d
  out.push(ESC, 0x40, ESC, 0x61, 0x01)
  out.push(GS, 0x21, 0x11, ...enc('CORNEY'), GS, 0x21, 0x00, 0x0a)
  out.push(...enc('TEST PRINT OK'), 0x0a, ...enc('Printer thermal siap.'), 0x0a, 0x0a, 0x0a)
  out.push(GS, 0x56, 0x00)
  await write(Uint8Array.from(out))
}
