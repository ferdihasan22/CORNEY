import { useSyncExternalStore } from 'react'
import { getRoleCreds, subscribeRoleCreds } from './roleAuth.js'

export function useRoleCreds() {
  return useSyncExternalStore(subscribeRoleCreds, getRoleCreds)
}
