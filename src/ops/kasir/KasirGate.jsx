import { Navigate } from 'react-router-dom'
import { useDay } from '../../store/useDay.js'
import { PHASE } from '../../store/day.js'

// Index for /ops/kasir — routes the kasir to the correct step and ENFORCES the
// Opening Day gate (PRD: selling is blocked until OPN-01 + OPN-02 are done).
export default function KasirGate() {
  const day = useDay()

  if (!day) return <Navigate to="/ops/kasir/login" replace />

  switch (day.phase) {
    case PHASE.OPENING:
      return <Navigate to="/ops/kasir/opening" replace />
    case PHASE.CASH:
      return <Navigate to="/ops/kasir/cash" replace />
    case PHASE.BELANJA:
      return <Navigate to="/ops/kasir/belanja-datang" replace />
    case PHASE.REMINDER:
      return <Navigate to="/ops/kasir/reminder" replace />
    case PHASE.SELLING:
    case PHASE.CLOSING:
    case PHASE.CLOSED:
      return <Navigate to="/ops/kasir/jualan" replace />
    default:
      return <Navigate to="/ops/kasir/login" replace />
  }
}
