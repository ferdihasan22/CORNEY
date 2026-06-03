import { useSyncExternalStore } from 'react'
import { getAuditLog, subscribeAuditLog } from './auditlog.js'

export function useAuditLog() {
  return useSyncExternalStore(subscribeAuditLog, getAuditLog)
}
