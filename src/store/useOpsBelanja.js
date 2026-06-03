import { useSyncExternalStore } from 'react'
import { getOpsBelanja, subscribeOpsBelanja } from './opsbelanja.js'

export function useOpsBelanja() {
  return useSyncExternalStore(subscribeOpsBelanja, getOpsBelanja)
}
