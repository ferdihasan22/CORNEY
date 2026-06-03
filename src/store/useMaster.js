import { useSyncExternalStore } from 'react'
import { getMaster, subscribeMaster } from './master.js'

// React binding for the master-data store. Re-renders when the owner edits the
// catalog (parent fillings added/edited/deactivated, etc.).
export function useMaster() {
  return useSyncExternalStore(subscribeMaster, getMaster)
}
