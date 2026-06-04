import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearRoleSession } from '../../auth/roleAuth.js'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { getState } from '../../store/day.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { useUsage } from '../../store/useUsage.js'
import { useExpense } from '../../store/useExpense.js'
import { aggregateByBranch, aggregateTotals, aggregatePeriod, topVariant, bottomVariant, lowStockList, peakHour, anomaliCount } from '../../store/aggregate.js'
import { useStockDaily } from '../../store/useStockDaily.js'
import { useFreezerCorrections } from '../../store/useFreezerCorrections.js'

// Step 1B.1 — OWN-01 Dashboard Kokpit. UI ported from Stitch
// "owner_cockpit_mobile_dashboard", made responsive (mobile → desktop grid).
// NOTE: real numbers are multi-branch + historical aggregates → need the
// backend (TAHAP 4). For Fase 1 this uses sample data; the pending-corrections
// count is pulled from the local kasir session where available.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const PERIODS = ['Hari ini', 'Minggu ini', 'Bulan ini', 'Custom']

export default function OwnerDashboard() {
  const navigate = useNavigate()
  const freezerKoreksiPending = (useFreezerCorrections() || []).filter((c) => c.status === 'pending').length
  const [period, setPeriod] = useState('Hari ini')

  // Local wiring: pending stock-correction approvals from the open kasir day.
  const day = getState()
  const pendingKoreksi = (day?.corrections || []).filter((c) => c.status === 'pending').length || 2

  // SEMUA angka DARI MASTER LAPORAN (satu-satunya sumber kebenaran) — LIVE.
  useSalesDaily(); useUsage(); useExpense(); useStockDaily()
  // Chip period → filter omzet/laba. 'Custom' belum punya date-picker → semua waktu.
  const PMAP = { 'Hari ini': 'Hari', 'Minggu ini': 'Minggu', 'Bulan ini': 'Bulan' }
  const aggP = PMAP[period]
  const tot = aggP ? aggregatePeriod(aggP) : aggregateTotals()
  const top = topVariant(); const bot = bottomVariant()
  const branchList = BRANCHES.map((b) => { const o = aggP ? aggregatePeriod(aggP, b.id).omzet : (aggregateByBranch()[b.id]?.omzet || 0); return { name: b.name, omzet: o, ok: o > 0 } })
  const anomali = anomaliCount()
  const lowList = lowStockList()
  const jam = peakHour()

  const Card = ({ className = '', children }) => (
    <section className={`bg-white p-padding-card rounded-2xl shadow-[0_4px_16px_0_rgba(26,26,26,0.08)] border border-outline-variant ${className}`}>{children}</section>
  )

  return (
    <div className="bg-background text-on-surface min-h-screen">
      {/* Header */}
      <header className="w-full top-0 sticky z-50 bg-primary-container shadow-[0_4px_16px_0_rgba(26,26,26,0.08)] text-white">
        <div className="flex justify-between items-center px-4 sm:px-6 h-[72px] max-w-6xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 shrink-0"><Icon name="arrow_back" /></button>
            <Icon name="storefront" className="text-3xl hidden sm:block" />
            <h1 className="font-display-md text-2xl sm:text-display-md tracking-tight truncate">CORNEY · Owner</h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="relative active:scale-95 cursor-pointer p-1">
              <Icon name="notifications" className="text-2xl" />
              <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-secondary-container ring-2 ring-primary-container" />
            </div>
            <button onClick={() => { clearRoleSession('owner'); navigate('/ops/owner/login') }} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10" title="Keluar"><Icon name="logout" className="text-2xl" /></button>
          </div>
        </div>
        <div className="flex gap-2 px-4 sm:px-6 pb-4 overflow-x-auto max-w-6xl mx-auto">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-full font-label-md whitespace-nowrap active:scale-95 transition-all ${period === p ? 'bg-white text-primary' : 'bg-primary text-white/80'}`}>{p}</button>
          ))}
        </div>
      </header>

      <main className="px-4 mt-6 pb-12 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        <p className="lg:col-span-3 text-[12px] text-on-surface-variant -mb-1">Menampilkan: <b>{period}</b> · <span className="italic">data contoh (Fase 1 — agregat nyata menyusul saat backend siap)</span></p>

        {/* 1. Omzet hero → Laporan Keuangan */}
        <button onClick={() => navigate('/ops/owner/laporan')} className="lg:col-span-2 text-left bg-white p-padding-card rounded-2xl shadow-[0_4px_16px_0_rgba(26,26,26,0.08)] border border-outline-variant flex flex-col gap-2 hover:border-primary active:scale-[.99] transition-all">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-md flex items-center gap-1">Total Omzet <Icon name="chevron_right" className="text-[18px]" /></span>
            <svg className="w-[100px] h-10" viewBox="0 0 100 40"><path d="M0,35 Q10,30 20,32 T40,20 T60,25 T80,10 T100,5" fill="none" stroke="#10B981" strokeLinecap="round" strokeWidth="3" /></svg>
          </div>
          <h2 className="font-display-md text-display-md text-primary">{fmtRp(tot.omzet)}</h2>
          <div className="flex items-center gap-1 text-emerald-600 font-label-md"><Icon name="trending_up" className="text-sm" /> {period} · semua cabang (Master Laporan)</div>
        </button>

        {/* 2. Anomali */}
        <section className="bg-error-container/30 border-2 border-error p-padding-card rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-error text-white p-2 rounded-xl"><Icon name="warning" /></div>
            <div>
              <h3 className="font-headline-md text-error">{anomali} perlu diperiksa</h3>
              <p className="font-body-md text-on-surface-variant">Deteksi transaksi tidak wajar</p>
            </div>
          </div>
          <Icon name="chevron_right" className="text-error" />
        </section>

        {/* 3. Menunggu tindakan */}
        <Card>
          <h3 className="font-label-lg text-on-surface-variant mb-3 flex items-center gap-2"><Icon name="pending_actions" className="text-[20px]" /> Menunggu Tindakan</h3>
          <div className="space-y-3">
            <button onClick={() => navigate('/ops/owner/koreksi')} className="w-full flex items-center gap-3 text-left active:scale-[.99] transition-transform">
              <div className="w-2 h-2 rounded-full bg-secondary-container shrink-0" />
              <p className="font-body-md flex-1">{pendingKoreksi} koreksi stok menunggu approval</p>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </button>
            <div className="flex items-start gap-3 border-t border-outline-variant pt-3"><div className="w-2 h-2 mt-2 rounded-full bg-secondary-container" /><p className="font-body-md">1 setoran belum diverifikasi</p></div>
          </div>
        </Card>

        {/* 4. Per cabang */}
        <Card>
          <h3 className="font-label-lg text-on-surface-variant mb-4">Per Cabang</h3>
          <div className="space-y-4">
            {branchList.map((b) => (
              <div key={b.name} className="flex justify-between items-center">
                <div className="flex items-center gap-3"><span className={`w-2 h-2 rounded-full ${b.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} /><p className="font-label-lg">{b.name}</p></div>
                <p className="font-label-lg text-primary">{fmtRp(b.omzet)}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* 5. Stok menipis */}
        <Card>
          <h3 className="font-label-lg text-on-surface-variant mb-3">Stok Menipis</h3>
          <div className="flex flex-wrap gap-2">
            {lowList.length === 0 ? (
              <span className="text-label-md text-green-700 flex items-center gap-1"><Icon name="check_circle" fill className="!text-[18px]" /> Stok aman semua.</span>
            ) : lowList.map((s, i) => (
              <div key={i} className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full font-label-md flex items-center gap-2">{s.name} <span className="font-bold">{s.qty} pcs</span></div>
            ))}
          </div>
        </Card>

        {/* 5b. Kelola data (master data shortcuts) */}
        <Card className="lg:col-span-3">
          <h3 className="font-label-lg text-on-surface-variant mb-3 flex items-center gap-2"><Icon name="database" className="text-[20px]" /> Kelola Data</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={() => navigate('/ops/owner/master/katalog')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="inventory_2" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Stok Isian & Menu</span>
              <span className="text-[11px] text-on-surface-variant">Isian induk + menu/varian jadi satu</span>
            </button>
            <button onClick={() => navigate('/ops/owner/koreksi')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="rule" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Koreksi Stok</span>
              <span className="text-[11px] text-on-surface-variant">Setujui pengajuan kasir</span>
            </button>
            <button onClick={() => navigate('/ops/owner/master/resep')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="receipt_long" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Resep / BOM</span>
              <span className="text-[11px] text-on-surface-variant">Bahan & estimasi HPP</span>
            </button>
            <button onClick={() => navigate('/ops/owner/cabang')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="storefront" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Kelola Cabang</span>
              <span className="text-[11px] text-on-surface-variant">Tambah/edit/nonaktif, jam, WA, kembalian, Stok Standar</span>
            </button>
            <button onClick={() => navigate('/ops/owner/promo')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="confirmation_number" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Sistem Promo</span>
              <span className="text-[11px] text-on-surface-variant">Diskon, voucher, B2G1</span>
            </button>
            <button onClick={() => navigate('/ops/owner/banner')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="ad_units" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Kelola Banner</span>
              <span className="text-[11px] text-on-surface-variant">Carousel app customer</span>
            </button>
            <button onClick={() => navigate('/ops/owner/notifikasi')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="notifications" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Notifikasi & Peringatan</span>
              <span className="text-[11px] text-on-surface-variant">Stok, kas, anomali, target</span>
            </button>
            <button onClick={() => navigate('/ops/owner/bagihasil')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="paid" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Bagi Hasil Investor</span>
              <span className="text-[11px] text-on-surface-variant">Dividen dari laba bersih</span>
            </button>
            <button onClick={() => navigate('/ops/owner/users')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="manage_accounts" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Manajemen User</span>
              <span className="text-[11px] text-on-surface-variant">Akun staf per peran/cabang</span>
            </button>
            <button onClick={() => navigate('/ops/owner/pengaturan')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="settings" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Pengaturan Aplikasi</span>
              <span className="text-[11px] text-on-surface-variant">Nomor WhatsApp komplain customer</span>
            </button>
            <button onClick={() => navigate('/ops/owner/harga-cabang')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="price_change" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Harga & Menu per Cabang</span>
              <span className="text-[11px] text-on-surface-variant">Override harga, sembunyikan menu</span>
            </button>
            <button onClick={() => navigate('/ops/owner/bukubesar')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="menu_book" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Buku Besar Pembelian</span>
              <span className="text-[11px] text-on-surface-variant">Harga terkini, dipesan vs diterima</span>
            </button>
            <button onClick={() => navigate('/ops/owner/tutup-bulan')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="event_available" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Tutup Bulan</span>
              <span className="text-[11px] text-on-surface-variant">Kunci laba final → bagi hasil</span>
            </button>
            <button onClick={() => navigate('/ops/owner/anomali')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="error" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Laporan Anomali</span>
              <span className="text-[11px] text-on-surface-variant">Semua kejanggalan + saran tindak</span>
            </button>
            <button onClick={() => navigate('/ops/owner/laporan-stok')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-secondary bg-secondary-container hover:brightness-95 active:scale-[.98] transition-all text-left shadow-sm">
              <Icon name="table_chart" fill className="text-on-secondary-container text-2xl" />
              <span className="font-label-lg leading-tight text-on-secondary-container font-bold">Master Laporan</span>
              <span className="text-[11px] text-on-secondary-container/80">Stok · Variant · Omzet · Omzet Bersih · Laba Bersih</span>
            </button>
            <button onClick={() => navigate('/ops/owner/agregat')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="leaderboard" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Agregat Lintas Cabang</span>
              <span className="text-[11px] text-on-surface-variant">Banding omzet/laba/anomali</span>
            </button>
            <button onClick={() => navigate('/ops/owner/analisa-bahan')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              <Icon name="science" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Analisa Bahan vs Jual</span>
              <span className="text-[11px] text-on-surface-variant">Deteksi pemakaian tak wajar</span>
            </button>
            <button onClick={() => navigate('/ops/owner/belanja')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-amber-400 bg-amber-50 hover:brightness-95 active:scale-[.98] transition-all text-left shadow-sm">
              <Icon name="shopping_basket" fill className="text-amber-700 text-2xl" />
              <span className="font-label-lg leading-tight text-amber-900 font-bold">Belanjaan</span>
              <span className="text-[11px] text-amber-800/80">Harga (naik/turun) · per hari/cabang/item</span>
            </button>
            <button onClick={() => navigate('/ops/owner/pesanan-online')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-blue-400 bg-blue-50 hover:brightness-95 active:scale-[.98] transition-all text-left shadow-sm">
              <Icon name="smartphone" fill className="text-blue-700 text-2xl" />
              <span className="font-label-lg leading-tight text-blue-900 font-bold">Pesanan Online</span>
              <span className="text-[11px] text-blue-800/80">Customer · Ambil/Maxim · harian/mingguan/bulanan</span>
            </button>
            <button onClick={() => navigate('/ops/owner/koreksi-freezer')} className="relative flex flex-col items-start gap-2 p-4 rounded-2xl border border-outline-variant bg-surface-container-low hover:border-primary active:scale-[.98] transition-all text-left">
              {freezerKoreksiPending > 0 && <span className="absolute top-3 right-3 bg-error text-on-error text-[11px] font-bold min-w-5 h-5 px-1 flex items-center justify-center rounded-full">{freezerKoreksiPending}</span>}
              <Icon name="ac_unit" className="text-primary text-2xl" />
              <span className="font-label-lg leading-tight">Koreksi Freezer</span>
              <span className="text-[11px] text-on-surface-variant">Setujui koreksi sisa dari Produksi</span>
            </button>
            <button onClick={() => navigate('/ops/owner/pelacakan-stok')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-teal-400 bg-teal-50 hover:brightness-95 active:scale-[.98] transition-all text-left shadow-sm">
              <Icon name="travel_explore" fill className="text-teal-700 text-2xl" />
              <span className="font-label-lg leading-tight text-teal-900 font-bold">Pelacakan Stok</span>
              <span className="text-[11px] text-teal-800/80">Lacak di mana stok bocor: Produksi · Transit · Kasir</span>
            </button>
            <button onClick={() => navigate('/ops/owner/mulai-bersih')} className="flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-rose-300 bg-rose-50 hover:brightness-95 active:scale-[.98] transition-all text-left shadow-sm">
              <Icon name="rocket_launch" fill className="text-rose-600 text-2xl" />
              <span className="font-label-lg leading-tight text-rose-900 font-bold">Mulai Bersih (Go-Live)</span>
              <span className="text-[11px] text-rose-800/80">Hapus data contoh & isi data awal usaha nyata</span>
            </button>
          </div>
        </Card>

        {/* 6. Wawasan 2x2 */}
        <section className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
            <p className="text-[12px] font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Terlaris</p>
            <p className="font-label-lg text-primary leading-tight">{top?.name || '—'}</p>
            <Icon name="star" fill className="text-secondary text-lg mt-3" />
          </div>
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
            <p className="text-[12px] font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Paling Sepi</p>
            <p className="font-label-lg text-tertiary leading-tight">{bot?.name || '—'}</p>
            <Icon name="trending_down" className="text-on-surface-variant text-lg mt-3" />
          </div>
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant relative">
            <p className="text-[12px] font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Laba Bersih</p>
            <p className={`font-label-lg leading-tight ${tot.laba < 0 ? 'text-error' : 'text-emerald-700'}`}>{fmtRp(tot.laba)}</p>
            <span className="absolute top-2 right-2 bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-bold">MASTER</span>
          </div>
          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
            <p className="text-[12px] font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Jam Ramai</p>
            <p className="font-label-lg text-on-surface leading-tight">{jam || '—'}</p>
            <div className="mt-3 flex items-end gap-1 h-6">
              {[2, 3, 6, 5, 2].map((h, i) => (<div key={i} className={`w-2 rounded-t ${h >= 5 ? 'bg-primary' : 'bg-primary/20'}`} style={{ height: h * 4 }} />))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
