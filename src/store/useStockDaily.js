import { useSyncExternalStore } from 'react'
import { getStockDaily, subscribeStockDaily } from './stockdaily.js'

export function useStockDaily() {
  return useSyncExternalStore(subscribeStockDaily, getStockDaily)
}
