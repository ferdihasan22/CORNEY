import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../data/menu.js'
import { useDay } from '../store/useDay.js'
import { PHASE } from '../store/day.js'
import { useMaster } from '../store/useMaster.js'
import { useBranchStatus } from '../store/useBranchStatus.js'
import { refreshBranchStatus } from '../store/branchStatus.js'
import { isSupabase } from '../lib/backend.js'

// 1C.2 — CORNEY App Customer · Pilih Cabang (PRD §4.4). Ported from Stitch
// "choose_branch_corney_app". Booth photos aren't available, so each card uses a
// branded tile (consistent + offline-safe) instead of a broken image. The
// decorative bottom nav (Orders/Promo/Profile = Fase 2) is stripped; the sticky
// "cabang terpilih dipakai selama belanja" note is kept.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

// Dummy storefront status (Fase 1) — real hours/geo come with the backend.
const STATUS = {
  sepinggan: { distance: '1.2 km', open: true, openUntil: '22:00', onlineUntil: '21:30', near: true },
  gunungsari: { distance: '3.5 km', open: true, openUntil: '22:00', onlineUntil: '21:30', near: false },
}

export default function CustomerChooseBranch() {
  const navigate = useNavigate()
  const day = useDay()
  useMaster() // re-render saat Owner tambah/edit/nonaktifkan cabang (sumber tunggal)
  const status = useBranchStatus() // status buka cabang dari SERVER (lintas perangkat)
  const [, tick] = useState(0)
  useEffect(() => {
    refreshBranchStatus() // ambil status terkini saat halaman dibuka
    const t = setInterval(() => tick((n) => n + 1), 60000) // re-cek jam tutup online tiap menit
    return () => clearInterval(t)
  }, [])
  const near = BRANCHES.find((b) => STATUS[b.id]?.near)
  const now = new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  // Cabang BUKA untuk online:
  //  - mode supabase → status SERVER: kasir buka HARI INI & belum lewat jam tutup
  //    online (terlihat lintas perangkat).
  //  - mode local → sesi day.js lokal (perangkat sama).
  const isOpen = (id) => {
    if (isSupabase()) {
      const st = status[id]
      const stop = BRANCHES.find((b) => b.id === id)?.stopOnline || '21:30'
      return !!st?.open && st.openDate === todayISO && nowHHMM <= stop
    }
    return !!day && day.branchId === id && day.phase === PHASE.SELLING
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-surface shadow-sm flex items-center justify-between px-4 h-[64px] shrink-0">
        <button onClick={() => navigate('/app')} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="arrow_back" /></button>
        <div className="absolute left-1/2 -translate-x-1/2 text-headline-lg font-headline-lg font-black text-primary uppercase tracking-tighter">CORNEY</div>
        <span className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-28 max-w-[480px] mx-auto w-full">
        <section className="text-center mb-5">
          <h1 className="font-headline-md text-headline-md text-on-surface mb-1">Pilih Cabang Terdekat</h1>
          <p className="font-body-md text-on-surface-variant">Menu &amp; harga bisa beda tiap cabang</p>
        </section>

        {near && (
          <div className="flex justify-center mb-7">
            <div className="inline-flex items-center gap-2 bg-surface-container-lowest px-4 py-2 rounded-full border border-outline-variant shadow-sm">
              <Icon name="location_on" className="text-primary text-[18px]" />
              <span className="font-label-md text-label-md">Dekat kamu: {near.name.replace('CORNEY ', '')} ({STATUS[near.id].distance})</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {BRANCHES.filter((b) => b.active !== false).map((b) => {
            const s = STATUS[b.id] || { distance: '', openUntil: '22:00', onlineUntil: '21:30' }
            const open = isOpen(b.id)
            return (
              <button
                key={b.id}
                onClick={() => open && navigate(`/app/katalog/${b.id}`)}
                disabled={!open}
                className={`relative flex items-stretch w-full rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(26,26,26,0.08)] text-left transition-all active:scale-[.98] ${open ? 'bg-white ring-1 ring-outline-variant hover:ring-2 hover:ring-primary' : 'bg-surface-container-high opacity-75 grayscale-[0.5] cursor-not-allowed'}`}
              >
                {/* Branded tile (placeholder for booth photo) */}
                <div className="w-1/3 min-h-[140px] relative bg-primary-container flex items-center justify-center overflow-hidden">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-primary rounded-full mix-blend-multiply blur-2xl opacity-60 -translate-x-1/3 -translate-y-1/3" />
                  <Icon name="storefront" fill className="text-on-primary-container !text-5xl relative z-10" />
                </div>
                <div className="w-2/3 p-4 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h3 className="font-headline-md text-[18px] leading-tight">{b.name}</h3>
                      <span className={`font-label-md text-[12px] shrink-0 ${s.near ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{s.distance}</span>
                    </div>
                    <p className="font-body-md text-[14px] text-on-surface-variant mb-2 line-clamp-1">{b.address}</p>
                    {open ? (
                      <span className="bg-green-100 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Buka · tutup {s.openUntil}</span>
                    ) : (
                      <span className="bg-surface-dim text-on-surface-variant text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Belum buka</span>
                    )}
                  </div>
                  <p className="font-label-md text-[12px] text-on-surface-variant italic">{open ? `online sampai ${s.onlineUntil}` : 'kasir belum buka toko hari ini'}</p>
                </div>
              </button>
            )
          })}
        </div>
      </main>

      <div className="fixed bottom-0 w-full z-50 max-w-[480px] left-1/2 -translate-x-1/2">
        <div className="bg-secondary-container text-on-secondary-container px-3 py-3 text-center font-label-md text-label-md">
          Cabang terpilih dipakai terus selama kamu belanja.
        </div>
      </div>
    </div>
  )
}
