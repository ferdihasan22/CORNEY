// CORNEY — Dispatcher printer thermal: pilih jalur sesuai platform.
//   • APK native (Capacitor) → btprinter.native.js (Bluetooth Classic via plugin)
//   • Web/PWA (Android Chrome) → btprinter.web.js   (Web Bluetooth BLE)
// API publik identik di kedua jalur, jadi pemanggil (Receipt, WalkinSale,
// useBtPrinter) tak perlu tahu bedanya. Pemilih printer native memakai
// scanPrinters/connectAddress dari btprinter.native.js secara langsung.
import * as web from './btprinter.web.js'
import * as native from './btprinter.native.js'

export const isNativePrinter = (() => {
  try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) } catch { return false }
})()

const impl = isNativePrinter ? native : web

export const btSupported = impl.btSupported
export const btConnected = impl.btConnected
export const btDeviceName = impl.btDeviceName
export const subscribeBt = impl.subscribeBt
export const btConnect = impl.btConnect
export const btAutoReconnect = impl.btAutoReconnect
export const btDisconnect = impl.btDisconnect
export const btPrintReceipt = impl.btPrintReceipt
export const btTestPrint = impl.btTestPrint
