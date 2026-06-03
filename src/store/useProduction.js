import { useSyncExternalStore } from 'react'
import { getProduction, subscribeProduction } from './production.js'

export function useProduction() {
  return useSyncExternalStore(subscribeProduction, getProduction)
}
