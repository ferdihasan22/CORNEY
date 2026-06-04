import { useSyncExternalStore } from 'react'
import { getBranchStatus, subscribeBranchStatus } from './branchStatus.js'

// Re-render saat status buka cabang berubah (kasir buka/tutup, lintas perangkat).
export function useBranchStatus() {
  return useSyncExternalStore(subscribeBranchStatus, getBranchStatus, getBranchStatus)
}
