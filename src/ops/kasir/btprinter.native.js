// CORNEY — Printer thermal jalur NATIVE (APK Capacitor) via plugin
// capacitor-thermal-printer (Bluetooth Classic / SPP, ESC/POS). Dipakai
// menggantikan Web Bluetooth yang TIDAK tersedia di Android WebView.
//
// Byte struk dibentuk receiptEscpos.js (sama persis dgn jalur web) lalu dikirim
// mentah via .raw() → struk identik. Status koneksi dilacak lewat event
// 'connected'/'disconnected' plugin. Izin Bluetooth (Android 12+) di-handle
// otomatis oleh plugin saat scan/connect.
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer'
import { buildReceipt, buildTestReceipt } from './receiptEscpos.js'

const subscribers = new Set()
let connected = false
let deviceName = ''
let listenersReady = false
let pendingConnect = null
const ADDR_KEY = 'corney_bt_printer_addr'
const NAME_KEY = 'corney_bt_printer_name'

function notify() { subscribers.forEach((fn) => fn()) }
export function subscribeBt(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }
export function btConnected() { return connected }
export function btDeviceName() { return deviceName }
export function btSupported() { return true } // native: plugin selalu tersedia

const readAddr = () => { try { return localStorage.getItem(ADDR_KEY) || '' } catch { return '' } }
const readName = () => { try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' } }

async function ensureListeners() {
  if (listenersReady) return
  listenersReady = true
  try {
    await CapacitorThermalPrinter.addListener('connected', (device) => {
      connected = true
      deviceName = (device && device.name) || (pendingConnect && pendingConnect.name) || deviceName || 'Printer'
      notify()
      if (pendingConnect) { const r = pendingConnect.resolve; pendingConnect = null; r() }
    })
    await CapacitorThermalPrinter.addListener('disconnected', () => {
      connected = false
      notify()
      if (pendingConnect) { const j = pendingConnect.reject; pendingConnect = null; j(new Error('Printer terputus saat menghubungkan.')) }
    })
  } catch { /* abaikan */ }
}

// Pindai printer terdekat. Plugin hanya memunculkan perangkat kelas IMAGING
// (= printer), jadi daftarnya bersih. onDevices(devices[]) dipanggil tiap update.
// Mengembalikan fungsi STOP (panggil saat pemilih ditutup).
export async function scanPrinters(onDevices) {
  await ensureListeners()
  let handle = null
  try {
    handle = await CapacitorThermalPrinter.addListener('discoverDevices', (data) => {
      onDevices((data && data.devices) || [])
    })
    await CapacitorThermalPrinter.startScan()
  } catch (e) {
    if (handle) { try { await handle.remove() } catch { /* noop */ } }
    throw new Error((e && e.message) || 'Gagal memindai. Pastikan Bluetooth menyala & izin diberikan.')
  }
  return async () => {
    try { await CapacitorThermalPrinter.stopScan() } catch { /* noop */ }
    try { if (handle) await handle.remove() } catch { /* noop */ }
  }
}

// Sambung ke MAC tertentu (dari pemilih atau tersimpan), tunggu konfirmasi event.
export async function connectAddress(address, name) {
  await ensureListeners()
  const wait = new Promise((resolve, reject) => {
    pendingConnect = { resolve, reject, name }
    setTimeout(() => {
      if (pendingConnect) { pendingConnect = null; reject(new Error('Gagal terhubung (timeout). Pastikan printer menyala & sudah dipasangkan di Bluetooth.')) }
    }, 12000)
  })
  try {
    await CapacitorThermalPrinter.connect({ address })
  } catch (e) {
    pendingConnect = null
    throw new Error((e && e.message) || 'Gagal menghubungkan printer.')
  }
  await wait // resolve saat event 'connected' tiba
  try { localStorage.setItem(ADDR_KEY, address); localStorage.setItem(NAME_KEY, deviceName) } catch { /* noop */ }
  return deviceName
}

// Tombol "hubungkan" generik: sambung ke printer tersimpan. Bila belum ada,
// lempar dgn code NO_SAVED → UI membuka pemilih printer.
export async function btConnect() {
  const addr = readAddr()
  if (!addr) { const e = new Error('Belum ada printer tersimpan.'); e.code = 'NO_SAVED'; throw e }
  return connectAddress(addr, readName())
}

// Reconnect senyap ke printer terakhir (dipanggil saat layar kasir dibuka).
export async function btAutoReconnect() {
  const addr = readAddr()
  if (!addr || connected) return false
  try { await connectAddress(addr, readName()); return true } catch { return false }
}

export async function btDisconnect() {
  try { await CapacitorThermalPrinter.disconnect() } catch { /* noop */ }
  connected = false
  notify()
}

export async function btPrintReceipt(sale, branch, menus, reprint = false) {
  if (!connected) throw new Error('Printer belum terhubung.')
  await CapacitorThermalPrinter.begin().raw(buildReceipt(sale, branch, menus, reprint)).write()
}

export async function btTestPrint() {
  if (!connected) throw new Error('Printer belum terhubung.')
  await CapacitorThermalPrinter.begin().raw(buildTestReceipt()).write()
}
