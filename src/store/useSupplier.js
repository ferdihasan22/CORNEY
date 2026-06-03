import { useSyncExternalStore } from 'react'
import { getSupplier, subscribeSupplier } from './supplier.js'

export function useSupplier() {
  return useSyncExternalStore(subscribeSupplier, getSupplier)
}
