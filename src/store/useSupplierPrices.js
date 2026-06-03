import { useSyncExternalStore } from 'react'
import { getSupplierPrices, subscribeSupplierPrices } from './supplierPrices.js'

export function useSupplierPrices() {
  return useSyncExternalStore(subscribeSupplierPrices, getSupplierPrices)
}
