import { useSyncExternalStore } from 'react'
import { getLedger, subscribeLedger } from './ledger.js'

export function useLedger() {
  return useSyncExternalStore(subscribeLedger, getLedger)
}
