import { useSyncExternalStore } from 'react'
import { getOpname, subscribeOpname } from './opname.js'

export function useOpname() {
  return useSyncExternalStore(subscribeOpname, getOpname)
}
