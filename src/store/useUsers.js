import { useSyncExternalStore } from 'react'
import { getUsers, subscribeUsers } from './users.js'

export function useUsers() {
  return useSyncExternalStore(subscribeUsers, getUsers)
}
