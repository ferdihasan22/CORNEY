import { useSyncExternalStore } from 'react'
import { getParStock, subscribeParStock } from './parstock.js'

export function useParStock() {
  return useSyncExternalStore(subscribeParStock, getParStock, getParStock)
}
