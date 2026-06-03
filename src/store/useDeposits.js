import { useSyncExternalStore } from 'react'
import { getDeposits, subscribeDeposits } from './deposits.js'

// React binding for the cash deposit store (OPS-04).
export function useDeposits() {
  return useSyncExternalStore(subscribeDeposits, getDeposits)
}
