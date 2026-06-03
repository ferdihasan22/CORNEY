import { useSyncExternalStore } from 'react'
import { getFreezerCorrections, subscribeFreezerCorrections } from './freezerCorrections.js'

export function useFreezerCorrections() {
  return useSyncExternalStore(subscribeFreezerCorrections, getFreezerCorrections)
}
