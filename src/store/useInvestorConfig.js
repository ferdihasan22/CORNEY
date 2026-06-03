import { useSyncExternalStore } from 'react'
import { getInvestorConfig, subscribeInvestorConfig } from './investorconfig.js'

export function useInvestorConfig() {
  return useSyncExternalStore(subscribeInvestorConfig, getInvestorConfig)
}
