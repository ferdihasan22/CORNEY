import { useSyncExternalStore } from 'react'
import { getSalesDaily, subscribeSalesDaily } from './salesdaily.js'

export function useSalesDaily() {
  return useSyncExternalStore(subscribeSalesDaily, getSalesDaily)
}
