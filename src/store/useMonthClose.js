import { useSyncExternalStore } from 'react'
import { getMonthClose, subscribeMonthClose } from './monthclose.js'

export function useMonthClose() {
  return useSyncExternalStore(subscribeMonthClose, getMonthClose)
}
