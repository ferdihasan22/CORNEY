import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, DUMMY_STOCK, DUMMY_SHIPMENT, BRANCHES } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { confirmOpeningStock, PHASE, todayDD } from '../../store/day.js'
import { useParStock } from '../../store/useParStock.js'
import { parOf } from '../../store/parstock.js'
import { useStockDaily } from '../../store/useStockDaily.js'
import { useSalesDaily } from '../../store/useSalesDaily.js'
import { hasSalesDay } from '../../store/salesdaily.js'
import { useShipments } from '../../store/useShipments.js'
import { arrivalByBranch, confirmShipmentsReceived } from '../../store/shipments.js'
import { latestSisaByBranch } from '../../store/aggregate.js'

// Step 1A.2 — OPN-01 Konfirmasi Stok Isian. UI ported from Stitch
// "Stock Confirmation - Buka Toko".
// Model: kasir counts TOTAL physical (fisik) = stok awal hari ini. Badge
// compares fisik vs STOK STANDAR (par level, set by Owner): above = Kelebihan,
// below = Kurang. Reconciliation fisik vs sistem (sisa+datang) = susut, still
// recorded for Owner (info bar).
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>
const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0 }
// Tema warna per isian induk — biar tiap kartu beda & gampang dibedakan.
const THEME = {
  mozza: { bd: 'border-amber-300', hd: 'bg-amber-100', ic: 'text-amber-700', tx: 'text-amber-900' },
  sosis: { bd: 'border-rose-300', hd: 'bg-rose-100', ic: 'text-rose-700', tx: 'text-rose-900' },
  jumbo: { bd: 'border-violet-300', hd: 'bg-violet-100', ic: 'text-violet-700', tx: 'text-violet-900' },
  mix: { bd: 'border-teal-300', hd: 'bg-teal-100', ic: 'text-teal-700', tx: 'text-teal-900' },
}
const DEFAULT_THEME = { bd: 'border-outline-variant', hd: 'bg-surface-container', ic: 'text-primary', tx: 'text-on-surface' }

export default function OpeningStock() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  useParStock() // Stok Standar (diatur Owner) — ikut update
  useStockDaily(); useShipments(); useSalesDaily() // sumber: Master Laporan (sisa kemarin) + kiriman Operasional
  // Sudah pernah closing untuk HARI INI? → peringatkan closing dobel akan menimpa laporan.
  const closedToday = day?.branchId ? hasSalesDay(todayDD(), day.branchId) : false
  // Sisa kemarin = Sisa Aktual closing terakhir di MASTER LAPORAN.
  // Belum ada closing (hari pertama pakai PWA) → kosong (0), bukan angka palsu.
  const masterSisa = latestSisaByBranch(day?.branchId)
  const sisaSystem = masterSisa || {}
  const firstDay = !masterSisa // belum pernah closing di cabang ini
  // Barang datang = kiriman Operasional yang menunggu (fallback contoh bila belum ada).
  const arrivalReal = arrivalByBranch(day?.branchId)
  const shipment = Object.keys(arrivalReal).length ? arrivalReal : (DUMMY_SHIPMENT[day?.branchId] || {})
  const fromKiriman = Object.keys(arrivalReal).length > 0
  const standard = parOf(day?.branchId)

  // Kasir WAJIB hitung sendiri → input dikosongkan (bukan pre-fill angka sistem/kiriman).
  // Mencegah "asal oke" supaya cek susut & kirim-vs-terima benar-benar bermakna.
  const [rows, setRows] = useState(() =>
    PARENT_FILLINGS.reduce((acc, p) => {
      acc[p.id] = { datang: '', sisaFisik: '' }
      return acc
    }, {}),
  )
  const patch = (id, key, value) => setRows((r) => ({ ...r, [id]: { ...r[id], [key]: value } }))

  const compute = (p) => {
    const sisa = sisaSystem[p.id] ?? 0
    const datang = num(rows[p.id].datang)
    const sisaFisik = num(rows[p.id].sisaFisik)
    const standar = standard[p.id] ?? 0
    const today = sisaFisik + datang // PRD: stok awal = sisa fisik + barang datang (app menjumlahkan)
    const susut = sisa - sisaFisik // sisa fisik < catatan sistem → susut (untuk Owner)
    const vsStandar = today - standar // badge: stok awal vs stok standar Owner
    return { sisa, datang, sisaFisik, standar, susut, vsStandar, today }
  }

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase !== PHASE.OPENING) return <Navigate to="/ops/kasir" replace />

  // Semua field harus diisi dulu (memastikan kasir benar-benar menghitung).
  const allFilled = PARENT_FILLINGS.every((p) => rows[p.id].sisaFisik !== '' && rows[p.id].datang !== '')

  function handleLock() {
    if (!allFilled) return
    const payload = PARENT_FILLINGS.map((p) => {
      const c = compute(p)
      return {
        parentId: p.id,
        sisaSystem: c.sisa,
        sisaFisik: c.sisaFisik,
        susut: c.susut,
        arrival: { datang: c.datang },
        today: c.today,
      }
    })
    confirmOpeningStock(payload)
    // Konfirmasi terima kiriman Operasional (sisi ke-2): jumlah datang yg diisi
    // kasir dicocokkan dgn yang dikirim → kiriman jadi Diterima/Selisih.
    if (fromKiriman) {
      const received = PARENT_FILLINGS.reduce((a, p) => { a[p.id] = num(rows[p.id].datang); return a }, {})
      confirmShipmentsReceived(day.branchId, received)
    }
    navigate('/ops/kasir/cash')
  }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-margin-page">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[80px] bg-primary-container text-on-primary-container z-50 flex items-center justify-between px-margin-page shadow-md">
        <div className="flex items-center gap-base">
          <Icon name="storefront" className="!text-[32px]" />
          <div className="flex flex-col">
            <span className="font-label-lg text-label-lg opacity-80 uppercase tracking-wider">Cabang</span>
            <span className="font-headline-md text-headline-md leading-tight">{branch.name}</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-display-md text-[24px] font-extrabold tracking-tight">Buka Toko</span>
          <span className="font-label-md text-label-md bg-white/20 px-3 py-1 rounded-full mt-1">Langkah 1 dari 4</span>
        </div>
      </header>

      <main className="mt-[100px] px-margin-page max-w-[1280px] mx-auto">
        <section className="mb-8">
          <h1 className="font-display-lg text-display-lg text-primary mb-2">Konfirmasi Stok Isian</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant flex items-center gap-2">
            <Icon name="inventory_2" className="text-secondary" />
            Hitung sisa kemarin di kulkas + barang yang datang. Stok awal dihitung otomatis.
          </p>
          {firstDay && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-blue-900">
              <Icon name="rocket_launch" className="!text-[20px] shrink-0 mt-0.5" />
              <p className="text-label-lg leading-snug"><b>Hari pertama pakai aplikasi.</b> Belum ada data kemarin — wajar. Cukup <b>hitung stok yang ADA SEKARANG</b> di kulkas dan isi di "Sisa kemarin di kulkas". <b>Barang datang = 0</b> (belum ada kiriman). Mulai besok, data sudah otomatis terisi.</p>
            </div>
          )}
          {closedToday && (
            <div className="mt-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex items-start gap-2 text-amber-900">
              <Icon name="warning" className="!text-[20px] shrink-0 mt-0.5" />
              <p className="text-label-lg leading-snug"><b>Hari ini ({todayDD()}) sudah pernah di-Closing.</b> Kalau kamu buka & Closing lagi, laporan hari ini akan <b>ditimpa</b> (angka closing sebelumnya hilang). Lanjutkan hanya bila memang perlu mengulang.</p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-4">
          {PARENT_FILLINGS.map((p) => {
            const c = compute(p)
            const cocok = c.vsStandar === 0
            const t = THEME[p.id] || DEFAULT_THEME
            return (
              <div key={p.id} className={`rounded-2xl border-2 ${t.bd} bg-surface-container-lowest shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex flex-col overflow-hidden`}>
                {/* Pita nama berwarna — kontras tinggi */}
                <div className={`${t.hd} px-4 py-2.5 flex items-center justify-between gap-2`}>
                  <h3 className={`font-bold text-headline-md leading-tight flex items-center gap-2 min-w-0 ${t.tx}`}><Icon name="kebab_dining" className={`!text-[22px] shrink-0 ${t.ic}`} /> <span>{p.name}</span></h3>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${cocok ? 'bg-green-600 text-white' : 'bg-white/80 text-on-surface border border-black/10'}`}>
                    {cocok ? 'Cocok' : c.vsStandar > 0 ? `Lebih ${c.vsStandar}` : `Kurang ${Math.abs(c.vsStandar)}`}
                  </span>
                </div>

                <div className="p-4 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-container rounded-lg p-2.5 text-center">
                      <p className="text-[10px] uppercase text-on-surface-variant leading-none">Sisa kemarin (sistem)</p>
                      <p className="font-headline-md text-headline-md text-on-surface leading-none mt-1">{c.sisa}</p>
                    </div>
                    <div className="bg-secondary-container/30 rounded-lg p-2.5 text-center border border-secondary-container">
                      <p className="text-[10px] uppercase text-on-secondary-container leading-none">Stok standar</p>
                      <p className="font-headline-md text-headline-md text-on-surface leading-none mt-1">{c.standar}</p>
                    </div>
                  </div>

                  <div>
                    <label className="font-label-md text-label-md block mb-1">1. Sisa kemarin di kulkas <span className="block text-[11px] text-on-surface-variant font-normal">hitung sendiri isian lama yang masih ada</span></label>
                    <input type="number" inputMode="numeric" value={rows[p.id].sisaFisik} placeholder="hitung dulu…" onChange={(e) => patch(p.id, 'sisaFisik', e.target.value.replace(/\D/g, ''))} className="w-full h-12 border-outline border-2 rounded-lg px-4 font-headline-md text-primary focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="font-label-md text-label-md block mb-1">2. Stok datang (+) <span className="block text-[11px] text-on-surface-variant font-normal">{fromKiriman ? 'Hitung sendiri & teliti barang yang baru datang. Selisih menjadi tanggung jawab kasir dan dapat memengaruhi gaji, jadi pastikan benar.' : 'hitung barang baru yang datang'}</span></label>
                    <input type="number" inputMode="numeric" value={rows[p.id].datang} placeholder="hitung dulu…" onChange={(e) => patch(p.id, 'datang', e.target.value.replace(/\D/g, ''))} className="w-full h-12 border-outline border-2 rounded-lg px-4 font-headline-md text-primary focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                  </div>

                  <div className={`${t.hd} rounded-lg px-3 py-2 text-center`}>
                    <p className={`font-bold ${t.tx}`}>Stok awal = {c.sisaFisik} + {c.datang} = {c.today}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">dihitung otomatis (sisa + datang)</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom action bar */}
        <div className="mt-12 bg-white rounded-xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] p-6 flex flex-col md:flex-row items-center justify-between gap-6 border-t-4 border-secondary-container">
          <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-lg flex-1">
            <Icon name="info" className="text-secondary-fixed-dim !text-[40px]" />
            <p className="font-body-md text-body-md text-on-surface-variant italic">
              Selisih fisik vs sistem tercatat otomatis sebagai data susut untuk Owner. Pastikan hitungan sudah benar sebelum lanjut.
            </p>
          </div>
          <button
            onClick={handleLock}
            disabled={!allFilled}
            className="bg-primary text-white h-[64px] px-10 rounded-lg font-headline-md flex items-center gap-3 active:scale-95 shadow-[0_4px_16px_rgba(26,26,26,0.08)] hover:brightness-110 transition-all disabled:opacity-40 disabled:active:scale-100"
          >
            {allFilled ? 'Konfirmasi & Lanjut ke Buka Kas' : 'Isi semua hitungan dulu'}
            <Icon name="arrow_forward" />
          </button>
        </div>
      </main>
    </div>
  )
}
