import { useSyncExternalStore } from 'react'
import { getCart, subscribeCart } from './cart.js'

// React binding for the customer cart store.
export function useCart() {
  return useSyncExternalStore(subscribeCart, getCart)
}
