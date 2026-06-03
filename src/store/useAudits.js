import { useSyncExternalStore } from 'react'
import { getAudits, subscribeAudits } from './audits.js'

export function useAudits() {
  return useSyncExternalStore(subscribeAudits, getAudits)
}
