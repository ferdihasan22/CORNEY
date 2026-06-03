import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, saveClosingUrgentRefund } from '../../store/day.js'

// Step 1A.12 — CLS-04/04b Uang Urgent & Refund. UI ported from Stitch
// "closing_urgent_cash_refunds_corney_pos" (decorative image card dropped,
// receipt-photo thumb → icon, edit → delete). Both totals feed the cash
// formula: Kas seharusnya = modal awal + penjualan tunai − uang urgent − refund.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>
let seq = 0
const nextId = () => 'M' + Date.now() + '-' + seq++

// "Ingat data ini" untuk uang harian karyawan — template tersimpan lintas hari,
// terisi otomatis besok & ter-update tiap closing (tanpa alasan).
const GAJI_KEY = 'corney_gaji_template'
const loadGajiTpl = () => { try { const a = JSON.parse(localStorage.getItem(GAJI_KEY)); return Array.isArray(a) ? a : [] } catch { return [] } }
const saveGajiTpl = (items) => { try { localStorage.setItem(GAJI_KEY, JSON.stringify(items.map((x) => ({ amount: x.amount, reason: x.reason || '' })))) } catch { /* ignore */ } }

function MoneyList({ title, icon, items, setItems, addLabel, note, emptyText, reasonRequired = true, reasonPlaceholder = 'Alasan (wajib)', children }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')
  const total = items.reduce((s, x) => s + x.amount, 0)

  function add() {
    if (amount <= 0 || (reasonRequired && !reason.trim())) return
    const t = new Date()
    setItems([...items, { id: nextId(), amount, reason: reason.trim(), ts: t.toISOString(), time: t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }])
    setAmount(0); setReason(''); setOpen(false)
  }

  return (
    <section className="bg-surface-container-low p-padding-card rounded-xl shadow-sm border border-outline-variant/30">
      <h2 className="text-headline-md font-headline-md text-primary mb-2 flex items-center gap-2"><Icon name={icon} /> {title}</h2>
      {note && <p className="text-body-md text-on-surface-variant mb-4 italic">{note}</p>}
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-outline-variant/50 rounded-lg bg-surface/50">
            <Icon name="history" className="text-outline-variant !text-4xl mb-2" />
            <p className="text-body-md text-on-surface-variant">{emptyText}</p>
          </div>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-outline-variant/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-surface-variant rounded-lg flex items-center justify-center border border-outline-variant/50"><Icon name="payments" className="text-on-surface-variant" /></div>
                <div>
                  <p className="text-body-lg font-bold">{fmtRp(it.amount)}</p>
                  <p className="text-body-md text-on-surface-variant">{it.reason ? `${it.reason} · ` : ''}{it.time}</p>
                </div>
              </div>
              <button onClick={() => setItems(items.filter((x) => x.id !== it.id))} className="text-primary hover:bg-primary-container/20 p-2 rounded-full transition-colors"><Icon name="delete" /></button>
            </div>
          ))
        )}

        {open ? (
          <div className="p-4 bg-white rounded-lg border border-outline space-y-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">Rp</span>
              <input type="text" inputMode="numeric" value={amount ? amount.toLocaleString('id-ID') : ''} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="Jumlah" className="w-full h-min-tap-target pl-10 pr-4 rounded-lg border border-outline focus:ring-2 focus:ring-primary outline-none font-bold" />
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder} className="w-full h-min-tap-target px-4 rounded-lg border border-outline focus:ring-2 focus:ring-primary outline-none" />
            <div className="flex gap-2">
              <button onClick={() => { setOpen(false); setAmount(0); setReason('') }} className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-md">Batal</button>
              <button onClick={add} disabled={amount <= 0 || (reasonRequired && !reason.trim())} className="flex-1 h-[44px] bg-primary text-on-primary rounded-lg font-label-lg disabled:opacity-40">Simpan</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className="w-full h-min-tap-target border-2 border-primary text-primary font-label-lg rounded-xl hover:bg-primary-container hover:text-on-primary-container transition-all flex items-center justify-center gap-2 active:scale-95">
            <Icon name="add" /> {addLabel}
          </button>
        )}

        {children}

        <div className="pt-4 border-t border-outline-variant/50 flex justify-between items-center">
          <p className="text-body-md text-on-surface-variant">Ringkasan</p>
          <p className="text-body-lg font-bold text-on-surface">Total: <span className="text-primary">{fmtRp(total)}</span></p>
        </div>
      </div>
    </section>
  )
}

export default function ClosingUrgentRefund() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const [urgent, setUrgent] = useState(day?.closing?.urgent?.items || [])
  const [refund, setRefund] = useState(day?.closing?.refund?.items || [])
  const [gaji, setGaji] = useState(() => {
    const today = day?.closing?.gaji?.items
    if (today && today.length) return today
    // Pre-fill from the remembered template (fresh ids, no time yet).
    return loadGajiTpl().map((x) => ({ id: nextId(), amount: x.amount, reason: x.reason || '', time: '' }))
  })
  const [rememberGaji, setRememberGaji] = useState(() => loadGajiTpl().length > 0)
  const [modalUsed, setModalUsed] = useState(day?.closing?.modalUsed?.items || [])

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />
  if (!day.closing?.recon) return <Navigate to="/ops/kasir/closing/rekon" replace />

  function lanjut() {
    const sum = (arr) => arr.reduce((s, x) => s + x.amount, 0)
    saveClosingUrgentRefund({ items: urgent, total: sum(urgent) }, { items: refund, total: sum(refund) }, { items: gaji, total: sum(gaji) }, { items: modalUsed, total: sum(modalUsed) })
    saveGajiTpl(rememberGaji ? gaji : []) // ingat / lupakan template gaji harian
    navigate('/ops/kasir/closing/tunai')
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <header className="bg-primary text-on-primary shadow-md sticky top-0 z-50 flex justify-between items-center w-full px-margin-page h-min-tap-target shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/ops/kasir/closing/rekon')} className="flex items-center justify-center h-min-tap-target w-min-tap-target rounded-full hover:bg-primary-container active:scale-95"><Icon name="arrow_back" /></button>
          <h1 className="text-headline-md font-headline-md font-bold">Tutup Toko — Catat Uang Keluar dari Laci</h1>
        </div>
        <div className="text-label-md font-label-md bg-on-primary/10 px-4 py-1.5 rounded-full border border-on-primary/20">Langkah 3/5</div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-6 md:p-margin-page gap-gutter-grid">
        <div className="flex-1 flex flex-col space-y-stack-gap">
          <MoneyList title="1. Uang Harian Karyawan (boleh kosong)" icon="badge" items={gaji} setItems={setGaji} addLabel="+ Catat uang harian" emptyText="Belum ada uang harian diambil" note="Upah harian yang diambil karyawan dari laci. Tidak perlu alasan." reasonRequired={false} reasonPlaceholder="Nama karyawan (opsional)">
            <label className="flex items-center gap-3 cursor-pointer select-none bg-secondary-fixed/20 rounded-lg p-3 border border-secondary-fixed/40">
              <input type="checkbox" checked={rememberGaji} onChange={(e) => setRememberGaji(e.target.checked)} className="w-5 h-5 accent-primary rounded shrink-0" />
              <span className="text-label-md text-on-surface">Ingat data ini — besok terisi otomatis (update tiap tutup toko)</span>
            </label>
          </MoneyList>
          <MoneyList title="2. Uang Urgent (keluar mendadak)" icon="payments" items={urgent} setItems={setUrgent} addLabel="+ Catat uang urgent" emptyText="Belum ada uang urgent hari ini" note="Uang tunai yang dipakai mendadak. Wajib tulis alasannya. Contoh: beli gas, plastik, galon air." />
          <MoneyList title="3. Uang Balik ke Pembeli (refund)" icon="assignment_return" items={refund} setItems={setRefund} addLabel="+ Catat uang balik" emptyText="Belum ada uang balik ke pembeli" note="Uang yang dikembalikan ke pembeli (misal pesanan batal). Selalu diambil dari laci tunai walau bayarnya QRIS." />
          <MoneyList title="4. Uang Kembalian yang Terpakai (boleh kosong)" icon="savings" items={modalUsed} setItems={setModalUsed} addLabel="+ Catat kembalian terpakai" emptyText="Uang kembalian utuh — tidak terpakai" note="Kalau uang kembalian (modal pagi) sebagian kepakai/diambil. Ini mengurangi modal yang disimpan buat besok, bukan hasil jualan." />

          <div className="bg-surface-variant p-6 rounded-xl border border-outline-variant/50">
            <div className="flex items-start gap-4">
              <Icon name="calculate" className="text-primary mt-1" />
              <div>
                <h3 className="text-label-lg font-bold text-on-surface mb-2">Cara hitungnya nanti</h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed">Uang yang disetor = <b>hasil jualan tunai − semua uang keluar di atas</b>.<br /><span className="text-label-md">Uang kembalian (modal pagi) dihitung sendiri di langkah berikutnya — jangan dicampur.</span></p>
              </div>
            </div>
          </div>

          <div className="pt-2 pb-8">
            <button onClick={lanjut} className="w-full h-min-tap-target bg-primary text-on-primary font-label-lg rounded-xl shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
              Lanjut: Hitung Uang di Laci <Icon name="chevron_right" />
            </button>
            <p className="text-center text-label-md text-on-surface-variant mt-4">Data tersimpan otomatis saat lanjut</p>
          </div>
        </div>

        <aside className="hidden lg:block w-80">
          <div className="bg-secondary-container p-6 rounded-xl border border-on-secondary-fixed-variant/10">
            <h3 className="font-bold text-on-secondary-container mb-3 flex items-center gap-2"><Icon name="info" /> Tips Closing</h3>
            <ul className="text-body-md text-on-secondary-fixed-variant space-y-3">
              <li className="flex gap-2"><span className="font-bold">1.</span> Pastikan semua nota belanja gas/bahan sudah dicatat.</li>
              <li className="flex gap-2"><span className="font-bold">2.</span> Refund tunai harus dicatat meskipun customer bayar via QRIS.</li>
              <li className="flex gap-2"><span className="font-bold">3.</span> Hitung uang di laci setelah langkah ini selesai.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  )
}
