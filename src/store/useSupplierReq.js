import { useSyncExternalStore } from 'react'
import { getSupplierReq, subscribeSupplierReq } from './supplierReq.js'

export function useSupplierReq() {
  return useSyncExternalStore(subscribeSupplierReq, getSupplierReq)
}
