import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtRp } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import { addPromo, updatePromo, togglePromoActive } from '../../store/master.js'

// 2.6 — OWN-10 Sistem Promo. Ported from Stitch "promo_system_corney_owner_mobile"
// (bottom-nav stripped). Owner-only: kasir applies promos, never invents them.
// Types: diskon (%/nominal), voucher (code+quota), beli_dapat (BxGy, free item =
// no wage cut per §6.8.4), happy_hour (time window). Safeguards: noCombine +
// max-discount cap. "Laporan Promo" tab is a placeholder (needs sales data).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const TYPE = {
  diskon: { label: 'DISKON', badge: 'text-primary bg-primary-fixed', icon: 'percent' },
  voucher: { label: 'VOUCHER', badge: 'text-on-tertiary-fixed-variant bg-tertiary-fixed', icon: 'sell' },
  beli_dapat: { label: 'BELI-DAPAT', badge: 'text-on-secondary-fixed-variant bg-secondary-fixed', icon: 'redeem' },
  happy_hour: { label: 'HAPPY HOUR', badge: 'text-on-secondary-fixed-variant bg-secondary-container', icon: 'schedule' },
}
const TARGETS = [['all', 'Semua Menu'], ['sweet', 'Menu Sweet'], ['savory', 'Menu Savory']]
const targetLabel = (t) => (TARGETS.find((x) => x[0] === t)?.[1]) || 'Semua Menu'

const valueDisplay = (p) => {
  if (p.type === 'beli_dapat') return `B${p.buyQty}G${p.getQty}`
  if (p.type === 'happy_hour') return p.discountKind === 'percent' ? `${p.value}%` : fmtRp(p.value)
  return p.discountKind === 'percent' ? `${p.value}%` : fmtRp(p.value)
}

const EMPTY = { name: '', type: 'diskon', discountKind: 'percent', value: '', buyQty: 2, getQty: 1, startTime: '15:00', endTime: '17:00', code: '', quota: '', target: 'all', noCombine: true, capMax: '' }

export default function OwnerPromos() {
  const navigate = useNavigate()
  const master = useMaster()
  const promos = master?.promos || []
  const [tab, setTab] = useState('kelola')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const openNew = () => { setForm(EMPTY); setEditing({}) }
  const openEdit = (p) => { setForm({ ...EMPTY, ...p, value: String(p.value ?? ''), quota: String(p.quota ?? ''), capMax: String(p.capMax ?? '') }); setEditing(p) }
  const close = () => setEditing(null)
  const save = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (editing?.id) updatePromo(editing.id, form)
    else addPromo(form)
    close()
  }

  const showDiscount = form.type === 'diskon' || form.type === 'voucher' || form.type === 'happy_hour'

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary-container text-on-primary-container shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[64px] max-w-5xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-md text-headline-md leading-tight flex-1">Sistem Promo</h1>
          <button onClick={openNew} className="bg-secondary-container text-on-secondary-container px-4 py-2 rounded-xl font-bold active:scale-95 transition-transform shrink-0">+ Buat Promo</button>
        </div>
        <div className="flex max-w-5xl mx-auto">
          {[['kelola', 'Kelola Promo'], ['laporan', 'Laporan Promo']].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 h-11 text-sm font-bold transition-all ${tab === k ? 'border-b-4 border-secondary-container' : 'opacity-70'}`}>{lbl}</button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 max-w-5xl mx-auto w-full">
        {tab === 'laporan' ? (
          <div className="py-16 text-center text-on-surface-variant">
            <Icon name="query_stats" className="!text-6xl opacity-30" />
            <p className="mt-3 font-medium">Laporan dampak promo ke omzet</p>
            <p className="text-sm mt-1">Tersedia saat data penjualan online terkumpul (Fase 2 + backend).</p>
          </div>
        ) : (
          <>
            <section className="bg-surface-container p-4 rounded-2xl border-l-4 border-primary shadow-sm flex items-start gap-3 mb-5">
              <Icon name="security" fill className="text-primary shrink-0" />
              <div>
                <p className="font-label-md text-on-surface-variant leading-tight">Keamanan Sistem</p>
                <p className="text-xs text-on-surface-variant/80 mt-1 italic">Kasir tidak bisa mengarang diskon sendiri. Setiap pemakaian berjejak — menutup celah diskon fiktif.</p>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promos.map((p) => {
                const t = TYPE[p.type] || TYPE.diskon
                return (
                  <div key={p.id} className={`bg-white p-padding-card rounded-2xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] relative overflow-hidden flex flex-col ${p.active ? '' : 'opacity-60 bg-surface-container-low'}`}>
                    <div className={`absolute top-0 right-0 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase tracking-wider ${p.active ? 'bg-primary' : 'bg-outline'}`}>{p.active ? 'Aktif' : 'Nonaktif'}</div>
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="min-w-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.badge}`}>{t.label}</span>
                        <h3 className="font-headline-md text-[20px] mt-2 leading-tight">{p.name}</h3>
                      </div>
                      <div className="text-right shrink-0">
                        {p.type === 'happy_hour' ? <Icon name="schedule" fill className="text-secondary !text-4xl" /> : <span className="text-display-md text-primary font-extrabold leading-none">{valueDisplay(p)}</span>}
                      </div>
                    </div>
                    <div className="space-y-2 mb-4 border-t border-surface-variant pt-3 flex-grow">
                      <div className="flex items-center gap-2 text-on-surface-variant"><Icon name="restaurant_menu" className="text-sm" /><span className="text-label-md">Target: {targetLabel(p.target)}</span></div>
                      {p.type === 'happy_hour' && <div className="flex items-center gap-2 text-on-surface-variant font-bold"><Icon name="timer" className="text-sm" /><span className="text-label-md">{p.startTime} – {p.endTime}</span></div>}
                      {p.type === 'voucher' && <div className="flex items-center gap-2 justify-between"><span className="font-mono bg-surface-container px-2 rounded border border-outline-variant text-label-md">{p.code}</span><span className="text-xs font-bold text-on-surface-variant">Quota: {p.quota}</span></div>}
                      {p.capMax > 0 && <div className="flex items-center gap-2 text-on-surface-variant"><Icon name="vertical_align_top" className="text-sm" /><span className="text-label-md">Maks diskon {fmtRp(p.capMax)}</span></div>}
                      {p.noCombine && <div className="flex items-center gap-2 text-error font-semibold"><Icon name="block" className="text-sm" /><span className="text-label-md">Tidak bisa digabung</span></div>}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"><Icon name="edit" /></button>
                      <button onClick={() => togglePromoActive(p.id)} title={p.active ? 'Jeda' : 'Aktifkan'} className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"><Icon name={p.active ? 'pause' : 'play_arrow'} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

      {/* Create / Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-stretch sm:justify-end" onClick={close}>
          <div className="w-full sm:w-[440px] max-h-[92vh] sm:max-h-none sm:h-full bg-surface rounded-t-[28px] sm:rounded-none shadow-2xl flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-outline-variant flex justify-between items-center sticky top-0 bg-surface z-10">
              <h2 className="font-headline-md text-headline-md text-primary">{editing.id ? 'Edit Promo' : 'Buat Promo Baru'}</h2>
              <button onClick={close} className="p-2 hover:bg-surface-variant rounded-full"><Icon name="close" /></button>
            </div>

            <form onSubmit={save} className="p-5 space-y-5">
              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant">Nama Promo</label>
                <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Contoh: Diskon Merdeka" className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-surface-container-lowest" />
              </div>

              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant">Tipe Promo</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(TYPE).map(([k, t]) => (
                    <button key={k} type="button" onClick={() => set({ type: k })} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-colors ${form.type === k ? 'border-primary bg-primary-fixed' : 'border-surface-variant'}`}>
                      <Icon name={t.icon} className={form.type === k ? 'text-primary' : ''} />
                      <span className="text-label-md capitalize">{t.label.toLowerCase().replace('_', ' ')}</span>
                    </button>
                  ))}
                </div>
              </div>

              {showDiscount && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="font-label-md text-on-surface-variant">Jenis</label>
                    <div className="flex bg-surface-container rounded-xl p-1 h-[52px]">
                      {[['percent', '%'], ['nominal', 'Rp']].map(([k, lbl]) => (
                        <button key={k} type="button" onClick={() => set({ discountKind: k })} className={`flex-1 rounded-lg font-bold transition-all ${form.discountKind === k ? 'bg-primary text-white' : 'text-on-surface-variant'}`}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="font-label-md text-on-surface-variant">Nilai</label>
                    <input type="number" min="0" value={form.value} onChange={(e) => set({ value: e.target.value })} placeholder={form.discountKind === 'percent' ? '20' : '5000'} className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
                  </div>
                </div>
              )}

              {form.type === 'beli_dapat' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="font-label-md text-on-surface-variant">Beli (qty)</label><input type="number" min="1" value={form.buyQty} onChange={(e) => set({ buyQty: e.target.value })} className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" /></div>
                  <div className="space-y-2"><label className="font-label-md text-on-surface-variant">Gratis (qty)</label><input type="number" min="1" value={form.getQty} onChange={(e) => set({ getQty: e.target.value })} className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" /></div>
                  <p className="col-span-2 text-xs text-on-surface-variant italic">Item gratis mengurangi stok tapi <strong>tidak memotong gaji</strong> (§6.8.4).</p>
                </div>
              )}

              {form.type === 'happy_hour' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="font-label-md text-on-surface-variant">Mulai</label><input type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" /></div>
                  <div className="space-y-2"><label className="font-label-md text-on-surface-variant">Selesai</label><input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" /></div>
                </div>
              )}

              {form.type === 'voucher' && (
                <div className="space-y-3 p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                  <p className="font-label-lg flex items-center gap-2"><Icon name="card_giftcard" className="text-sm" /> Pengaturan Voucher</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="KODE" className="h-11 px-3 rounded-lg border border-outline-variant text-sm font-mono bg-surface-container-lowest" />
                    <input type="number" min="0" value={form.quota} onChange={(e) => set({ quota: e.target.value })} placeholder="Quota" className="h-11 px-3 rounded-lg border border-outline-variant text-sm bg-surface-container-lowest" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="font-label-md text-on-surface-variant">Target</label>
                <select value={form.target} onChange={(e) => set({ target: e.target.value })} className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest appearance-none">
                  {TARGETS.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
                </select>
              </div>

              {/* Safeguards */}
              <div className="space-y-3">
                <p className="font-label-lg text-on-surface">Safeguard &amp; Batasan</p>
                <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-outline-variant">
                  <div className="flex items-center gap-3"><Icon name="block" className="text-error" /><span className="text-body-md">Tidak bisa digabung</span></div>
                  <button type="button" onClick={() => set({ noCombine: !form.noCombine })} className={`relative w-12 h-7 rounded-full transition-colors ${form.noCombine ? 'bg-primary' : 'bg-surface-variant'}`}><span className={`absolute top-1 h-5 w-5 bg-white rounded-full shadow transition-all ${form.noCombine ? 'left-6' : 'left-1'}`} /></button>
                </div>
                {showDiscount && form.discountKind === 'percent' && (
                  <div className="space-y-2">
                    <label className="text-xs text-on-surface-variant px-1 uppercase tracking-tight">Maksimal Diskon (Cap)</label>
                    <input type="number" min="0" value={form.capMax} onChange={(e) => set({ capMax: e.target.value })} placeholder="50000" className="w-full h-[52px] px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
                  </div>
                )}
              </div>

              <button type="submit" className="w-full h-[52px] bg-primary text-on-primary font-headline-md rounded-xl shadow-lg active:scale-[0.98] transition-all">Simpan Promo</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
