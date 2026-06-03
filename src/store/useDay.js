import { useSyncExternalStore } from 'react'
import { getState, subscribe } from './day.js'

// React binding for the day store. Any component re-renders when the day
// session changes (stock confirmed, cash set, sale recorded, day closed).
export function useDay() {
  return useSyncExternalStore(subscribe, getState)
}
