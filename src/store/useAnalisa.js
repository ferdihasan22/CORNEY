import { useSyncExternalStore } from 'react'
import { getAnalisa, subscribeAnalisa } from './analisa.js'

export function useAnalisa() {
  return useSyncExternalStore(subscribeAnalisa, getAnalisa, getAnalisa)
}
