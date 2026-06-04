import { useSyncExternalStore } from 'react'
import { getAppConfig, subscribeAppConfig } from './appconfig.js'

// Hook React untuk membaca konfigurasi global aplikasi (mis. nomor komplain).
export function useAppConfig() {
  return useSyncExternalStore(subscribeAppConfig, getAppConfig, getAppConfig)
}
