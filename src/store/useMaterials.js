import { useSyncExternalStore } from 'react'
import { getMaterials, subscribeMaterials } from './materials.js'

export function useMaterials() {
  return useSyncExternalStore(subscribeMaterials, getMaterials)
}
