import { useSyncExternalStore } from 'react'
import { getUsage, subscribeUsage } from './usage.js'

export function useUsage() {
  return useSyncExternalStore(subscribeUsage, getUsage, getUsage)
}
