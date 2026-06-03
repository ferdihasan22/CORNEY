import { useSyncExternalStore } from 'react'
import { getExpense, subscribeExpense } from './expense.js'

export function useExpense() {
  return useSyncExternalStore(subscribeExpense, getExpense, getExpense)
}
