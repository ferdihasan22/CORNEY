import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import AuthGate from './auth/AuthGate.jsx'
const RoleLogin = lazy(() => import('./auth/RoleLogin.jsx'))
// Lazy-load tiap halaman → di-pecah jadi chunk terpisah. Kasir hanya mengunduh
// kode kasir, Owner hanya kode owner, dst. Ringan & cepat di tablet jadul.
const KasirLogin = lazy(() => import('./ops/kasir/KasirLogin.jsx'))
const KasirGate = lazy(() => import('./ops/kasir/KasirGate.jsx'))
const OpeningStock = lazy(() => import('./ops/kasir/OpeningStock.jsx'))
const OpeningCash = lazy(() => import('./ops/kasir/OpeningCash.jsx'))
const OpeningShopping = lazy(() => import('./ops/kasir/OpeningShopping.jsx'))
const OpeningReminder = lazy(() => import('./ops/kasir/OpeningReminder.jsx'))
const WalkinSale = lazy(() => import('./ops/kasir/WalkinSale.jsx'))
const CookingQueue = lazy(() => import('./ops/kasir/CookingQueue.jsx'))
const RequestStockCorrection = lazy(() => import('./ops/kasir/RequestStockCorrection.jsx'))
const RiwayatTransaksi = lazy(() => import('./ops/kasir/RiwayatTransaksi.jsx'))
const KasirOnline = lazy(() => import('./ops/kasir/KasirOnline.jsx'))
const ClosingShopping = lazy(() => import('./ops/kasir/ClosingShopping.jsx'))
const AuditHariIni = lazy(() => import('./ops/kasir/AuditHariIni.jsx'))
const ClosingRecon = lazy(() => import('./ops/kasir/ClosingRecon.jsx'))
const ClosingReconcile = lazy(() => import('./ops/kasir/ClosingReconcile.jsx'))
const ClosingUrgentRefund = lazy(() => import('./ops/kasir/ClosingUrgentRefund.jsx'))
const ClosingReport = lazy(() => import('./ops/kasir/ClosingReport.jsx'))
const OwnerDashboard = lazy(() => import('./ops/owner/OwnerDashboard.jsx'))
const OwnerStockApproval = lazy(() => import('./ops/owner/OwnerStockApproval.jsx'))
const OwnerParentFillings = lazy(() => import('./ops/owner/OwnerParentFillings.jsx'))
const OwnerMenus = lazy(() => import('./ops/owner/OwnerMenus.jsx'))
const OwnerRecipes = lazy(() => import('./ops/owner/OwnerRecipes.jsx'))
const OwnerFinancialReports = lazy(() => import('./ops/owner/OwnerFinancialReports.jsx'))
const OwnerBranches = lazy(() => import('./ops/owner/OwnerBranches.jsx'))
const OwnerPromos = lazy(() => import('./ops/owner/OwnerPromos.jsx'))
const OwnerBanners = lazy(() => import('./ops/owner/OwnerBanners.jsx'))
const CustomerLanding = lazy(() => import('./app/CustomerLanding.jsx'))
const CustomerChooseBranch = lazy(() => import('./app/CustomerChooseBranch.jsx'))
const CustomerCatalog = lazy(() => import('./app/CustomerCatalog.jsx'))
const CustomerProductDetail = lazy(() => import('./app/CustomerProductDetail.jsx'))
const CustomerReceipt = lazy(() => import('./app/CustomerReceipt.jsx'))
const CustomerCart = lazy(() => import('./app/CustomerCart.jsx'))
const CustomerCheckout = lazy(() => import('./app/CustomerCheckout.jsx'))
const CustomerQris = lazy(() => import('./app/CustomerQris.jsx'))
const CustomerSuccess = lazy(() => import('./app/CustomerSuccess.jsx'))
const CustomerTrack = lazy(() => import('./app/CustomerTrack.jsx'))
const CustomerOrders = lazy(() => import('./app/CustomerOrders.jsx'))
const OperasionalLanding = lazy(() => import('./ops/operasional/OperasionalLanding.jsx'))
const OperasionalSetoran = lazy(() => import('./ops/operasional/OperasionalSetoran.jsx'))
const OperasionalStockPar = lazy(() => import('./ops/operasional/OperasionalStockPar.jsx'))
const OperasionalAudit = lazy(() => import('./ops/operasional/OperasionalAudit.jsx'))
const OperasionalShopping = lazy(() => import('./ops/operasional/OperasionalShopping.jsx'))
const ProduksiLanding = lazy(() => import('./ops/produksi/ProduksiLanding.jsx'))
const ProduksiProduction = lazy(() => import('./ops/produksi/ProduksiProduction.jsx'))
const ProduksiFreezer = lazy(() => import('./ops/produksi/ProduksiFreezer.jsx'))
const ProduksiOpname = lazy(() => import('./ops/produksi/ProduksiOpname.jsx'))
const OperasionalAnalisa = lazy(() => import('./ops/operasional/OperasionalAnalisa.jsx'))
const OwnerNotifications = lazy(() => import('./ops/owner/OwnerNotifications.jsx'))
const OwnerInvestor = lazy(() => import('./ops/owner/OwnerInvestor.jsx'))
const OwnerUsers = lazy(() => import('./ops/owner/OwnerUsers.jsx'))
const OwnerSettings = lazy(() => import('./ops/owner/OwnerSettings.jsx'))
const OwnerBranchOverride = lazy(() => import('./ops/owner/OwnerBranchOverride.jsx'))
const OwnerLedger = lazy(() => import('./ops/owner/OwnerLedger.jsx'))
const OwnerMonthClose = lazy(() => import('./ops/owner/OwnerMonthClose.jsx'))
const CustomerJoin = lazy(() => import('./app/CustomerJoin.jsx'))
const CustomerRewards = lazy(() => import('./app/CustomerRewards.jsx'))
const AuditorLanding = lazy(() => import('./ops/auditor/AuditorLanding.jsx'))
const AuditorDeposit = lazy(() => import('./ops/auditor/AuditorDeposit.jsx'))
const AuditorTrace = lazy(() => import('./ops/auditor/AuditorTrace.jsx'))
const AuditorLog = lazy(() => import('./ops/auditor/AuditorLog.jsx'))
const OwnerAnomali = lazy(() => import('./ops/owner/OwnerAnomali.jsx'))
const OwnerAnalisaBahan = lazy(() => import('./ops/owner/OwnerAnalisaBahan.jsx'))
const OwnerCrossBranch = lazy(() => import('./ops/owner/OwnerCrossBranch.jsx'))
const OwnerStockReport = lazy(() => import('./ops/owner/OwnerStockReport.jsx'))
const OwnerParStock = lazy(() => import('./ops/owner/OwnerParStock.jsx'))
const OwnerCatalog = lazy(() => import('./ops/owner/OwnerCatalog.jsx'))
const OwnerBelanja = lazy(() => import('./ops/owner/OwnerBelanja.jsx'))
const OwnerOnlineOrders = lazy(() => import('./ops/owner/OwnerOnlineOrders.jsx'))
const OwnerFreezerApproval = lazy(() => import('./ops/owner/OwnerFreezerApproval.jsx'))
const OwnerStockTrace = lazy(() => import('./ops/owner/OwnerStockTrace.jsx'))
const OwnerGoLive = lazy(() => import('./ops/owner/OwnerGoLive.jsx'))
const OwnerOpeningStock = lazy(() => import('./ops/owner/OwnerOpeningStock.jsx'))
const SupplierLogin = lazy(() => import('./supplier/SupplierLogin.jsx'))
const SupplierRequest = lazy(() => import('./supplier/SupplierRequest.jsx'))
const SupplierPrices = lazy(() => import('./supplier/SupplierPrices.jsx'))
const SupplierHistory = lazy(() => import('./supplier/SupplierHistory.jsx'))

// CORNEY ecosystem shell — 3 separate apps (PRD §2.1):
//  /app       → CORNEY App (customer, public)
//  /ops       → CORNEY Ops (internal, role-based: kasir/produksi/operasional/owner/auditor)
//  /supplier  → CORNEY Supplier (standalone)
// Fase 1 builds /ops/kasir first (the heart). Other routes are placeholders for now.

function Placeholder({ title, note }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="corney-swirl text-white font-extrabold text-3xl px-6 py-3 rounded-xl shadow-lg">
        CORNEY
      </div>
      <p className="mt-3 text-corney-dark italic text-sm">#CeritanyaBersamaCorney</p>
      <h1 className="mt-8 text-xl font-bold text-corney-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{note}</p>
      <Link to="/" className="mt-6 text-corney font-semibold underline">← Kembali</Link>
    </div>
  )
}

// Routing per-SUBDOMAIN produksi: tiap domain langsung ke app-nya, tak lewat pemilih.
// corney.pages.dev / localhost → 'all' (pemilih lengkap untuk dev/preview).
const HOST_APP = {
  'corney.id': 'customer', 'www.corney.id': 'customer',
  'dapur.corney.id': 'kasir', 'gudang.corney.id': 'supplier',
  'kantor.corney.id': 'kantor',
}
function hostApp() {
  // Build native (Capacitor APK) memaksa satu app via VITE_APP_TARGET — di WebView
  // hostname = 'localhost' jadi tak bisa andalkan domain. mis. APK Kasir → 'kasir'.
  const forced = (import.meta.env.VITE_APP_TARGET || '').toLowerCase()
  if (forced) return forced
  return (typeof window !== 'undefined' && HOST_APP[window.location.hostname]) || 'all'
}

function Home() {
  const host = hostApp()
  if (host === 'customer') return <Navigate to="/app" replace />
  if (host === 'kasir') return <Navigate to="/ops/kasir/login" replace />
  if (host === 'supplier') return <Navigate to="/supplier" replace />
  const allApps = [
    { to: '/ops/kasir/login', label: 'CORNEY Ops — Kasir', desc: 'Login → Buka Toko → Jualan → Closing (P0)' },
    { to: '/ops/owner', label: 'CORNEY Ops — Owner', desc: 'Dashboard & laporan (P0)' },
    { to: '/ops/operasional', label: 'CORNEY Ops — Operasional', desc: 'Ambil setoran tunai, isi stok ke standar' },
    { to: '/ops/produksi', label: 'CORNEY Ops — Produksi', desc: 'Catat hasil produksi, stok freezer' },
    { to: '/ops/auditor', label: 'CORNEY Ops — Auditor', desc: 'Verifikasi setoran, telusur selisih, audit log' },
    { to: '/app', label: 'CORNEY App — Customer', desc: 'Katalog menu & struk digital' },
    { to: '/supplier', label: 'CORNEY Supplier', desc: 'Standalone (P1)' },
  ]
  // kantor.corney.id → hanya 4 role back-office (owner/operasional/produksi/auditor).
  const apps = host === 'kantor'
    ? allApps.filter((a) => a.to.startsWith('/ops/') && a.to !== '/ops/kasir/login')
    : allApps
  return (
    <div className="min-h-full p-6 max-w-md mx-auto">
      <div className="text-center pt-8">
        <div className="corney-swirl inline-block text-white font-extrabold text-4xl px-7 py-3 rounded-2xl shadow-lg">
          CORNEY
        </div>
        <p className="mt-3 text-corney-dark italic">#CeritanyaBersamaCorney</p>
      </div>
      <div className="mt-10 space-y-3">
        {apps.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm active:scale-[.99] transition"
          >
            <div className="font-bold text-corney-ink">{a.label}</div>
            <div className="text-sm text-gray-500">{a.desc}</div>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-gray-400">Fase 1 · data dummy · referensi PRD v1.0</p>
    </div>
  )
}

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="corney-swirl text-white font-extrabold text-2xl px-5 py-2.5 rounded-xl shadow-lg animate-flash">CORNEY</div>
    </div>
  )
}

import SyncStatus from './components/SyncStatus.jsx'
import KasirAlerts from './ops/kasir/KasirAlerts.jsx'
import PwaAutoUpdate from './components/PwaAutoUpdate.jsx' // ⚠️ SEMENTARA (testing) — hapus nanti

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
    <AuthGate>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ops/kasir/login" element={<KasirLogin />} />
      <Route path="/ops/owner/login" element={<RoleLogin role="owner" />} />
      <Route path="/ops/operasional/login" element={<RoleLogin role="operasional" />} />
      <Route path="/ops/produksi/login" element={<RoleLogin role="produksi" />} />
      <Route path="/ops/auditor/login" element={<RoleLogin role="auditor" />} />
      <Route path="/ops/kasir" element={<KasirGate />} />
      <Route path="/ops/kasir/opening" element={<OpeningStock />} />
      <Route path="/ops/kasir/cash" element={<OpeningCash />} />
      <Route path="/ops/kasir/belanja-datang" element={<OpeningShopping />} />
      <Route path="/ops/kasir/reminder" element={<OpeningReminder />} />
      <Route path="/ops/kasir/jualan" element={<WalkinSale />} />
      <Route path="/ops/kasir/online" element={<KasirOnline />} />
      <Route path="/ops/kasir/masak" element={<CookingQueue />} />
      <Route path="/ops/kasir/koreksi" element={<RequestStockCorrection />} />
      <Route path="/ops/kasir/riwayat" element={<RiwayatTransaksi />} />
      <Route path="/ops/kasir/audit" element={<AuditHariIni />} />
      <Route path="/ops/kasir/closing/belanja" element={<ClosingShopping />} />
      <Route path="/ops/kasir/closing/rekon" element={<ClosingRecon />} />
      <Route path="/ops/kasir/closing/tunai" element={<ClosingReconcile />} />
      <Route path="/ops/kasir/closing/urgent" element={<ClosingUrgentRefund />} />
      <Route path="/ops/kasir/closing/laporan" element={<ClosingReport />} />
      <Route path="/ops/owner" element={<OwnerDashboard />} />
      <Route path="/ops/owner/koreksi" element={<OwnerStockApproval />} />
      <Route path="/ops/owner/master/katalog" element={<OwnerCatalog />} />
      <Route path="/ops/owner/master/isian" element={<OwnerCatalog />} />
      <Route path="/ops/owner/master/menu" element={<OwnerCatalog />} />
      <Route path="/ops/owner/master/resep" element={<OwnerRecipes />} />
      <Route path="/ops/owner/laporan" element={<OwnerFinancialReports />} />
      <Route path="/ops/owner/cabang" element={<OwnerBranches />} />
      <Route path="/ops/owner/promo" element={<OwnerPromos />} />
      <Route path="/ops/owner/banner" element={<OwnerBanners />} />
      <Route path="/app" element={<CustomerLanding />} />
      <Route path="/app/cabang" element={<CustomerChooseBranch />} />
      <Route path="/app/katalog/:branchId" element={<CustomerCatalog />} />
      <Route path="/app/produk/:branchId/:menuId" element={<CustomerProductDetail />} />
      <Route path="/app/struk/:saleId" element={<CustomerReceipt />} />
      <Route path="/app/struk" element={<CustomerReceipt />} />
      <Route path="/app/keranjang" element={<CustomerCart />} />
      <Route path="/app/checkout" element={<CustomerCheckout />} />
      <Route path="/app/qris/:orderId" element={<CustomerQris />} />
      <Route path="/app/sukses/:orderId" element={<CustomerSuccess />} />
      <Route path="/app/lacak/:orderId" element={<CustomerTrack />} />
      <Route path="/app/riwayat" element={<CustomerOrders />} />
      <Route path="/app/join" element={<CustomerJoin />} />
      <Route path="/app/rewards" element={<CustomerRewards />} />
      <Route path="/ops/operasional" element={<OperasionalLanding />} />
      <Route path="/ops/operasional/setoran" element={<OperasionalSetoran />} />
      <Route path="/ops/operasional/stok" element={<OperasionalStockPar />} />
      <Route path="/ops/operasional/audit" element={<OperasionalAudit />} />
      <Route path="/ops/operasional/belanja" element={<OperasionalShopping />} />
      <Route path="/ops/operasional/analisa" element={<OperasionalAnalisa />} />
      <Route path="/ops/produksi" element={<ProduksiLanding />} />
      <Route path="/ops/produksi/produksi" element={<ProduksiProduction />} />
      <Route path="/ops/produksi/freezer" element={<ProduksiFreezer />} />
      <Route path="/ops/produksi/opname" element={<ProduksiOpname />} />
      <Route path="/ops/owner/notifikasi" element={<OwnerNotifications />} />
      <Route path="/ops/owner/bagihasil" element={<OwnerInvestor />} />
      <Route path="/ops/owner/users" element={<OwnerUsers />} />
      <Route path="/ops/owner/pengaturan" element={<OwnerSettings />} />
      <Route path="/ops/owner/harga-cabang" element={<OwnerBranchOverride />} />
      <Route path="/ops/owner/bukubesar" element={<OwnerLedger />} />
      <Route path="/ops/owner/tutup-bulan" element={<OwnerMonthClose />} />
      <Route path="/ops/owner/anomali" element={<OwnerAnomali />} />
      <Route path="/ops/owner/analisa-bahan" element={<OwnerAnalisaBahan />} />
      <Route path="/ops/owner/agregat" element={<OwnerCrossBranch />} />
      <Route path="/ops/owner/laporan-stok" element={<OwnerStockReport />} />
      <Route path="/ops/owner/belanja" element={<OwnerBelanja />} />
      <Route path="/ops/owner/pesanan-online" element={<OwnerOnlineOrders />} />
      <Route path="/ops/owner/koreksi-freezer" element={<OwnerFreezerApproval />} />
      <Route path="/ops/owner/pelacakan-stok" element={<OwnerStockTrace />} />
      <Route path="/ops/owner/mulai-bersih" element={<OwnerGoLive />} />
      <Route path="/ops/owner/stok-awal" element={<OwnerOpeningStock />} />
      <Route path="/ops/owner/stok-standar" element={<OwnerParStock />} />
      <Route path="/ops/auditor" element={<AuditorLanding />} />
      <Route path="/ops/auditor/setoran" element={<AuditorDeposit />} />
      <Route path="/ops/auditor/telusur" element={<AuditorTrace />} />
      <Route path="/ops/auditor/log" element={<AuditorLog />} />
      <Route path="/supplier" element={<SupplierLogin />} />
      <Route path="/supplier/request" element={<SupplierRequest />} />
      <Route path="/supplier/harga" element={<SupplierPrices />} />
      <Route path="/supplier/riwayat" element={<SupplierHistory />} />
      {/* Path tak dikenal (mis. callback login Cloudflare Access /authorized?...) →
          PULIH ke beranda, yang lalu arahkan ke login sesuai subdomain. Cegah
          terjebak di 404 setelah login Access. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AuthGate>
    <SyncStatus />
    <KasirAlerts />
    <PwaAutoUpdate />
    </Suspense>
  )
}
