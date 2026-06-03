import { useSyncExternalStore } from 'react'
import { getOrders, subscribeOrders } from './orders.js'

// React binding for the customer orders store.
export function useOrders() {
  return useSyncExternalStore(subscribeOrders, getOrders)
}
