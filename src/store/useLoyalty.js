import { useSyncExternalStore } from 'react'
import { getMember, subscribeMember } from './loyalty.js'

export function useLoyalty() {
  return useSyncExternalStore(subscribeMember, getMember)
}
