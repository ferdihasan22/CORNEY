import { useSyncExternalStore } from 'react'
import { getSupplierFulfilled, subscribeSupplierFulfilled } from './supplierFulfilled.js'

export function useSupplierFulfilled() {
  return useSyncExternalStore(subscribeSupplierFulfilled, getSupplierFulfilled)
}
