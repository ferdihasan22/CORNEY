import { useNavigate, useLocation } from 'react-router-dom'
import { useSupplierReq } from '../store/useSupplierReq.js'
import { clearSupplierSession } from './session.js'

// Shared bottom nav for the standalone Supplier portal.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const TABS = [
  { to: '/supplier/request', icon: 'assignment', label: 'Request' },
  { to: '/supplier/harga', icon: 'sell', label: 'Harga' },
  { to: '/supplier/riwayat', icon: 'history', label: 'Riwayat' },
]

export default function SupplierNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const orders = useSupplierReq() || []
  const pending = orders.filter((o) => o.status !== 'selesai').length
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-surface border-t border-outline-variant flex justify-around items-center px-1 py-2 min-h-[68px] z-50">
      {TABS.map((t) => {
        const active = pathname === t.to
        return (
          <button key={t.to} onClick={() => navigate(t.to)} className={`relative flex flex-col items-center justify-center px-2.5 py-1 rounded-xl active:scale-90 transition-all ${active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'}`}>
            {t.to === '/supplier/request' && pending > 0 && <span className="absolute -top-0.5 right-1 bg-error text-on-error text-[10px] font-bold min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full">{pending}</span>}
            <Icon name={t.icon} fill={active} />
            <span className="text-[11px] font-label-md mt-0.5">{t.label}</span>
          </button>
        )
      })}
      <button onClick={() => { clearSupplierSession(); navigate('/supplier') }} className="flex flex-col items-center justify-center px-2.5 py-1 rounded-xl active:scale-90 transition-all text-on-surface-variant" title="Keluar">
        <Icon name="logout" />
        <span className="text-[11px] font-label-md mt-0.5">Keluar</span>
      </button>
    </nav>
  )
}
