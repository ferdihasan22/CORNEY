import { useSyncExternalStore } from 'react'
import { getFreezer, subscribeFreezer } from './freezer.js'

export function useFreezer() {
  return useSyncExternalStore(subscribeFreezer, getFreezer)
}
