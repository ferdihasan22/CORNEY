import { useSyncExternalStore } from 'react'
import { subscribeBt, btConnected } from './btprinter.js'

// true/false apakah printer Bluetooth (BLE) sedang terhubung.
export function useBtPrinter() {
  return useSyncExternalStore(subscribeBt, btConnected)
}
