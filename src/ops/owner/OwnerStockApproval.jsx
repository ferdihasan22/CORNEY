import { useNavigate } from 'react-router-dom'
import { PARENT_FILLINGS, BRANCHES } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { resolveCorrection } from '../../store/day.js'

// 1B.5 — OW-07 Eksekusi Koreksi Stok. UI ported from Stitch
// "stock_correction_approval_corney_owner", made responsive and wired to the
// real local day session. PRD separation of duties: the kasir PROPOSES a
// correction (BHN-06), only the Owner here EXECUTES it. Decorative sidebar +
// mobile bottom-nav from the reference are stripped (not in the PRD nav model).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const parentName = (id) => PARENT_FILLINGS.find((p) => p.id === id)?.name ?? id
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })

export default function OwnerStockApproval() {
  const navigate = useNavigate()
  const day = useDay()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)

  const corrections = day?.corrections || []
  const pending = corrections.filter((c) => c.status === 'pending')
  const resolved = corrections.filter((c) => c.status !== 'pending')

  const handle = (id, approve) => resolveCorrection(id, approve)

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-on-primary shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[64px] max-w-6xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-md text-headline-md leading-tight">Persetujuan Stok</h1>
          {pending.length > 0 && (
            <div className="bg-secondary-container text-on-secondary-container px-3 py-0.5 rounded-full font-label-md text-label-md flex items-center gap-1 shrink-0">
              <Icon name="pending_actions" className="text-[18px]" />
              {pending.length} menunggu
            </div>
          )}
          <span className="ml-auto text-xs text-on-primary/80 truncate hidden sm:block">{branch?.name}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        {/* Warning note (separation of duties) */}
        <div className="bg-secondary-fixed text-on-secondary-fixed p-padding-card rounded-2xl flex gap-4 items-start shadow-sm border border-secondary-container/50 mb-stack-gap">
          <Icon name="security" fill className="text-secondary !text-3xl shrink-0" />
          <div className="space-y-1">
            <p className="font-bold text-label-lg">Catatan Keamanan Penting</p>
            <p className="text-body-md leading-relaxed">Eksekusi koreksi ada di tangan Owner, bukan kasir — agar yang memegang barang tidak bisa menutupi jejaknya sendiri.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-grid">
          {/* Pending requests */}
          <div className="lg:col-span-8 space-y-stack-gap">
            <h3 className="font-headline-md text-headline-md text-on-surface-variant">Permintaan Menunggu</h3>

            {pending.length === 0 ? (
              <div className="bg-white rounded-2xl border border-outline-variant p-10 flex flex-col items-center justify-center text-center text-on-surface-variant">
                <Icon name="task_alt" className="!text-5xl opacity-30" />
                <p className="mt-3 font-medium">Tidak ada koreksi yang menunggu.</p>
                <p className="text-sm mt-1">Pengajuan koreksi stok dari kasir akan muncul di sini.</p>
              </div>
            ) : (
              pending.map((c) => {
                const up = c.delta >= 0
                return (
                  <div key={c.id} className="bg-white rounded-2xl p-padding-card shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-surface-variant">
                    <div className="flex justify-between items-start gap-3 mb-4">
                      <div className="min-w-0">
                        <h4 className="font-headline-sm text-headline-sm text-primary">{parentName(c.parentId)}</h4>
                        <p className="text-on-surface-variant font-label-md truncate">Outlet: {branch?.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="block font-display-md text-display-md text-on-surface leading-none">
                          {c.systemQty} <span className={up ? 'text-primary-container' : 'text-on-surface-variant/40'}>→</span> {c.physicalQty}
                        </span>
                        <span className={`font-bold text-headline-sm ${up ? 'text-primary' : 'text-error'}`}>({up ? '+' : ''}{c.delta})</span>
                      </div>
                    </div>

                    <div className="bg-surface-container-low p-3 rounded-lg mb-5 border border-outline-variant/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name="notes" className="text-[18px]" />
                        <p className="font-label-md text-on-surface-variant">Alasan Koreksi</p>
                      </div>
                      <p className="italic text-body-md">{c.reason ? `"${c.reason}"` : '(tanpa alasan)'}</p>
                      <div className="mt-2 text-label-md opacity-60 flex items-center gap-1">
                        <Icon name="person" className="text-[14px]" />
                        Diajukan kasir · {fmtTime(c.ts)}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => handle(c.id, true)} className="flex-1 min-h-[52px] bg-primary text-on-primary rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2">
                        <Icon name="check_circle" fill />
                        Setujui &amp; Eksekusi
                      </button>
                      <button onClick={() => handle(c.id, false)} className="flex-1 min-h-[52px] border-2 border-primary text-primary rounded-2xl font-bold hover:bg-primary/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Icon name="cancel" />
                        Tolak
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Audit trail (immutable) */}
          <div className="lg:col-span-4">
            <div className="bg-surface-container-low rounded-2xl p-padding-card border border-outline-variant lg:sticky lg:top-24 shadow-inner">
              <div className="mb-5 border-b border-outline-variant pb-4">
                <h3 className="font-headline-md text-headline-md text-on-surface-variant">Riwayat Koreksi</h3>
                <div className="flex items-center gap-2 text-tertiary">
                  <Icon name="lock_clock" className="text-[18px]" />
                  <p className="font-label-md">Tercatat berjejak (tak bisa diubah)</p>
                </div>
              </div>

              {resolved.length === 0 ? (
                <p className="text-sm text-on-surface-variant py-6 text-center">Belum ada koreksi yang diproses hari ini.</p>
              ) : (
                <div className="space-y-3">
                  {resolved.map((c) => {
                    const ok = c.status === 'approved'
                    return (
                      <div key={c.id} className="bg-white/70 p-3 rounded-xl border border-outline-variant/50">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-on-surface">{parentName(c.parentId)}</span>
                          <span className="text-label-md text-tertiary">{fmtDate(c.resolvedAt || c.ts)}</span>
                        </div>
                        <div className="flex justify-between items-center text-label-md">
                          <span className="text-on-surface-variant">{branch?.name?.replace('CORNEY ', '')}</span>
                          <span className="font-bold">{c.systemQty} → {c.physicalQty}</span>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold uppercase tracking-wider ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ok ? 'Setuju' : 'Ditolak'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
