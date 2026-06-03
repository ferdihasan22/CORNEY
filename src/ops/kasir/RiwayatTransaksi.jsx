import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MENUS, BRANCHES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, payPending } from '../../store/day.js'
import Receipt from './Receipt.jsx'
import PaymentModal from './PaymentModal.jsx'

// Riwayat Transaksi (kasir) — daftar transaksi hari ini dari `sales[]`, terbaru
// di atas. Tap → struk (CETAK ULANG, STR-01 reprint). No Stitch ref — designed
// consistent with the kasir design system.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

const STATUS = {
  lunas: { label: 'Lunas', cls: 'bg-green-100 text-green-700' },
  terverifikasi: { label: 'QRIS ✓', cls: 'bg-green-100 text-green-700' },
  terklaim: { label: 'QRIS GoPay', cls: 'bg-yellow-100 text-yellow-700' },
  gofood: { label: 'GoFood', cls: 'bg-green-100 text-green-800' },
  grabfood: { label: 'GrabFood', cls: 'bg-emerald-100 text-emerald-800' },
  pending_payment: { label: 'Belum bayar', cls: 'bg-secondary-fixed text-on-secondary-fixed-variant' },
}
const COOK = { queued: 'Antre', frying: 'Digoreng', completed: 'Selesai' }
const itemsLabel = (s) => s.lines.map((l) => `${l.qty}x ${MENUS.find((m) => m.id === l.menuId)?.name ?? l.menuId}`).join(', ')

export default function RiwayatTransaksi() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const [struk, setStruk] = useState(null)
  const [payFor, setPayFor] = useState(null)

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  const sales = [...(day.sales || [])].reverse() // newest first
  const omzet = (day.sales || []).filter((s) => s.paid).reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md flex items-center gap-3 px-4 sm:px-margin-page h-[64px] shrink-0">
        <button onClick={() => navigate('/ops/kasir/jualan')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary-container active:scale-95"><Icon name="arrow_back" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="font-headline-md text-headline-md leading-tight">Riwayat Transaksi</h1>
          <p className="text-xs text-on-primary/80 truncate">{branch.name} · hari ini</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold leading-none">{(day.sales || []).length} trx</p>
          <p className="text-[11px] text-on-primary/80">{fmtRp(omzet)}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-margin-page">
        <div className="max-w-2xl mx-auto space-y-3">
          {sales.length === 0 ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-on-surface-variant">
              <Icon name="receipt_long" className="!text-6xl opacity-30" />
              <p className="mt-3 font-medium">Belum ada transaksi hari ini.</p>
            </div>
          ) : (
            sales.map((s) => {
              const st = STATUS[s.status] || STATUS.lunas
              return (
                <div
                  key={s.id}
                  onClick={() => setStruk(s)}
                  className="w-full text-left bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-[0_2px_10px_rgba(26,26,26,0.06)] p-4 active:scale-[.99] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-on-surface">#{String(s.no).padStart(3, '0')}</span>
                      <span className="text-on-surface-variant text-sm">{new Date(s.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      {s.cook && <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant uppercase">{COOK[s.cook.status] || ''}</span>}
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-on-surface mt-1.5 line-clamp-1">{itemsLabel(s)}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className="text-on-surface-variant text-sm flex items-center gap-1"><Icon name="receipt" className="!text-base" /> Lihat / cetak struk</span>
                    <div className="flex items-center gap-3">
                      {!s.paid && (
                        <button onClick={(e) => { e.stopPropagation(); setPayFor(s) }} className="bg-primary text-on-primary text-sm font-bold px-4 py-1.5 rounded-lg active:scale-95 flex items-center gap-1">
                          <Icon name="payments" className="!text-base" /> Bayar
                        </button>
                      )}
                      <span className="font-display-md text-headline-md text-primary">{fmtRp(s.total)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>

      {struk && <Receipt sale={struk} branch={branch} reprint onClose={() => setStruk(null)} />}
      {payFor && (
        <PaymentModal
          total={payFor.total}
          onClose={() => setPayFor(null)}
          onComplete={({ method, cashReceived }) => {
            const s = payPending(payFor.id, { method, cashReceived })
            setPayFor(null)
            if (s) setStruk(s)
          }}
        />
      )}
    </div>
  )
}
