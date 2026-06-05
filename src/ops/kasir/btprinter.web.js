// CORNEY — Printer thermal via Web Bluetooth (BLE). Jalur ini untuk WEB/PWA
// (Android Chrome, HTTPS) & printer BLE. Di APK native dipakai btprinter.native.js
// (Bluetooth Classic via plugin). Byte ESC/POS dibentuk receiptEscpos.js (dipakai
// bersama kedua jalur → struk identik).
import { buildReceipt, buildTestReceipt } from './receiptEscpos.js'

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

export async function btPrintReceipt(sale, branch, menus, reprint = false) {
  await write(buildReceipt(sale, branch, menus, reprint))
}

export async function btTestPrint() {
  await write(buildTestReceipt())
}

// Apakah pernah ada printer di-set (untuk memutuskan auto-print perlu antre/skip).
export function isPrinterConfigured() {
  try { return !!localStorage.getItem(LAST_ID_KEY) } catch { return false }
}

// Segarkan koneksi (mis. saat app kembali ke depan). BLE dikelola event gatt →
// cukup coba reconnect senyap bila terputus.
export async function refreshConnection() {
  try { if (!btConnected()) await btAutoReconnect() } catch { /* noop */ }
}
