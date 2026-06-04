import { useEffect } from 'react'
import { useSyncExternalStore } from 'react'
import { getBranchLive, subscribeBranchLive, startBranchLiveSync } from './branchLive.js'

// Hook Owner: omzet berjalan per cabang (live). Memulai sinkron saat dipasang.
export function useBranchLive() {
  useEffect(() => { startBranchLiveSync() }, [])
  return useSyncExternalStore(subscribeBranchLive, getBranchLive, getBranchLive)
}
