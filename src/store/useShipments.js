import { useSyncExternalStore } from 'react'
import { getShipments, subscribeShipments } from './shipments.js'

export function useShipments() {
  return useSyncExternalStore(subscribeShipments, getShipments)
}
