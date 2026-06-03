import { Navigate, useLocation } from 'react-router-dom'
import { hasRoleSession } from './roleAuth.js'
import { getSupplierSession } from '../supplier/session.js'

// CORNEY — Gerbang auth terpusat. Membungkus <Routes>: bila path masuk area sebuah
// role tapi belum login, alihkan ke layar login role itu. Halaman login & area
// publik (customer, home, 404) dibiarkan terbuka.
const LOGIN = {
  owner: '/ops/owner/login', operasional: '/ops/operasional/login',
  produksi: '/ops/produksi/login', auditor: '/ops/auditor/login',
  kasir: '/ops/kasir/login', supplier: '/supplier',
}
function areaOf(p) {
  if (p.startsWith('/ops/owner')) return 'owner'
  if (p.startsWith('/ops/operasional')) return 'operasional'
  if (p.startsWith('/ops/produksi')) return 'produksi'
  if (p.startsWith('/ops/auditor')) return 'auditor'
  if (p.startsWith('/ops/kasir')) return 'kasir'
  if (p.startsWith('/supplier')) return 'supplier'
  return null
}
function kasirLoggedIn() { return !!(localStorage.getItem('corney_kasir_branch') || sessionStorage.getItem('corney_kasir_branch')) }

export default function AuthGate({ children }) {
  const { pathname } = useLocation()
  const area = areaOf(pathname)
  if (!area) return children // publik
  if (pathname === LOGIN[area]) return children // halaman login terbuka
  const ok = area === 'kasir' ? kasirLoggedIn() : area === 'supplier' ? !!getSupplierSession() : hasRoleSession(area)
  return ok ? children : <Navigate to={LOGIN[area]} replace />
}
