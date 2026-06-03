import { useSyncExternalStore } from 'react'
import { getShoppingItems, subscribeShoppingItems } from './shopping.js'

export function useShoppingItems() {
  return useSyncExternalStore(subscribeShoppingItems, getShoppingItems)
}
