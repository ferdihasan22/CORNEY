import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BRANCHES, SAUCES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, endDay, cookingCounts } from '../../store/day.js'
import { flyBall, pulse } from './flyBall.js'
import { clearKasirBranch } from './kasirSession.js'
import { useMaster } from '../../store/useMaster.js'
import { useOrders } from '../../store/useOrders.js'
import { advanceOrder } from '../../store/orders.js'

// 2.2 — §6.5 Tab Order Online (POS). Ported from Stitch "online_orders_corney_pos"
// but adapted to the kasir TABLET (portrait-first, 1 col → responsive grid) and
// stripped of the reference's decorative sidebar (Dashboard/Inventory/Reports are
// not in the PRD). Jalur 1: paid orders auto-appear here regardless of WA. WA
// staged buttons (Jalur 2, comms only) open wa.me pre-typed AND advance status on
// the same press: Konfirmasi Terima→Diproses · Pesanan Siap→Siap · Selesai→Selesai.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

// Jadwal ambil: cegah corndog dibuat kepagian. Sebaiknya mulai buat ~20 menit
// sebelum jam ambil. minsUntil < 0 = sudah lewat jam ambil.
const LEAD_MIN = 20
const minsUntil = (hhmm) => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); const n = new Date(); return (h * 60 + m) - (n.getHours() * 60 + n.getMinutes()) }
const shiftHHMM = (hhmm, delta) => { if (!hhmm) return ''; const [h, m] = hhmm.split(':').map(Number); const t = (((h * 60 + m + delta) % 1440) + 1440) % 1440; const p = (x) => String(x).padStart(2, '0'); return `${p(Math.floor(t / 60))}:${p(t % 60)}` }

// WA number → international for wa.me (08.. → 628..).
const waIntl = (raw) => {
  const s = (raw || '').replace(/\D/g, '')
  return s.startsWith('0') ? '62' + s.slice(1) : s
}
// Pretty grouping for display: 0895-3418-69458.
const waPretty = (raw) => (raw || '').replace(/\D/g, '').replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3')

// Short beep via Web Audio (no asset) — rings when a new order arrives.
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'; o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    o.start(); o.stop(ctx.currentTime + 0.42)
  } catch { /* autoplay blocked until first interaction — fine */ }
}

export default function KasirOnline() {
  const day = useDay()
  const master = useMaster()
  const orders = useOrders()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const [tab, setTab] = useState('aktif') // 'aktif' | 'selesai'
  const [contacted, setContacted] = useState(() => new Set()) // manual "sudah dihubungi"
  const [menuOpen, setMenuOpen] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [copiedId, setCopiedId] = useState(null) // order yg nomornya baru disalin
  const copyWa = async (o) => { try { await navigator.clipboard.writeText(waIntl(o.wa)); setCopiedId(o.id); setTimeout(() => setCopiedId(null), 1800) } catch { /* clipboard blocked */ } }

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Orders for THIS branch that are paid (= entered via Jalur 1) DAN dari sesi hari
  // ini saja (createdAt ≥ startedAt) — biar order/Selesai hari kemarin tidak nongol
  // lagi; buka hari baru = tampilan otomatis fresh. Data lama tetap tersimpan.
  const mine = useMemo(
    () => (orders || []).filter((o) => o.branchId === day?.branchId && o.paid && (!day?.startedAt || new Date(o.createdAt).getTime() >= day.startedAt)),
    [orders, day]
  )
  const newCount = mine.filter((o) => o.status === 'baru').length

  // Ring on a NEW order (count goes up). Seed the ref to the initial count so we
  // don't beep on first paint.
  const prevNew = useRef(null)
  const masakRef = useRef(null) // target animasi bola → tombol Antrean Masak
  useEffect(() => {
    if (prevNew.current === null) { prevNew.current = newCount; return }
    if (newCount > prevNew.current) beep()
    prevNew.current = newCount
  }, [newCount])

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />

  const menuName = (id) => (master?.menus || []).find((m) => m.id === id)?.name || id
  const sauceLabel = (sauces) => {
    if (!sauces?.length) return ''
    return sauces.map((s) => SAUCES.find((x) => x.id === s.id)?.name || s.id).join(', ')
  }
  const minsAgo = (iso) => {
    const m = Math.round((clock - new Date(iso)) / 60000)
    if (m < 1) return 'baru saja'
    if (m < 60) return `${m} mnt lalu`
    return `${Math.floor(m / 60)} jam lalu`
  }
  const itemsText = (o) => o.lines.map((l) => `${l.qty}x ${menuName(l.menuId)}`).join(', ')

  function handleLogout() {
    endDay()
    clearKasirBranch()
    navigate('/ops/kasir/login', { replace: true })
  }

  // Staged WA + status advance on the same press (Jalur 2 is comms-only — status
  // moves regardless, so the order never blocks on WA).
  // Nama titik penjemputan di Maxim (di-set Owner per cabang; fallback nama cabang).
  const maximName = (master?.branches || []).find((b) => b.id === day?.branchId)?.maximName || branch.name
  // Link Google Maps cabang (di-set Owner) → dikirim ke customer ambil sendiri.
  const branchMaps = (master?.branches || []).find((b) => b.id === day?.branchId)?.maps || ''
  const cook = cookingCounts() // {queued, frying} untuk badge tombol Antrean Masak

  const stageAction = (o) => {
    const noFmt = `#${String(o.no).padStart(3, '0')}`
    // Tutorial pesan Maxim yang ramah + arahan PIN di catatan kurir.
    const maximTutorial =
      `Halo ${o.name || 'kak'}! 🌽🎉 Pesanan ${noFmt} kamu sudah SIAP & masih anget!\n\n` +
      `Tinggal panggil Maxim ya, gampang banget:\n` +
      `1️⃣ Buka aplikasi Maxim → pilih menu *Pengiriman / Delivery*\n` +
      `2️⃣ Titik *penjemputan*: ketik *${maximName}*\n` +
      `3️⃣ Titik *pengantaran*: isi lokasi/alamat kamu\n` +
      `4️⃣ Di kolom *Catatan untuk kurir*, tulis: *PIN ${o.pin}* · *No. WA kamu: ${o.wa}*\n` +
      `   (No. WA biar driver bisa menghubungi kamu kalau ada kendala)\n` +
      `5️⃣ Pesan, lalu santai tunggu kurirnya datang 🛵💨\n\n` +
      `Nanti kurirnya cukup sebut *PIN ${o.pin}* ke kami. Selamat menikmati, #CeritanyaBersamaCorney! 🧡`
    const ambilReady =
      `Halo ${o.name || 'kak'}! 🌽🎉 Pesanan ${noFmt} sudah SIAP. ` +
      `Silakan ambil di booth ${branch.name} & sebutkan *PIN ${o.pin}* ya. Sampai jumpa! 🧡` +
      (branchMaps ? `\n\n📍 Lokasi booth: ${branchMaps}` : '')
    if (o.status === 'baru') {
      return {
        label: 'Konfirmasi Terima', color: 'bg-primary', wa: true,
        text: `Halo ${o.name || 'kak'}! Pesanan ${noFmt} (PIN ${o.pin}) sudah kami TERIMA & sedang dibuat. Terima kasih sudah pesan di ${branch.name}! 🧡`,
      }
    }
    if (o.status === 'diproses') {
      return {
        label: 'Pesanan Siap', color: 'bg-blue-600', wa: true,
        text: o.method === 'maxim' ? maximTutorial : ambilReady,
      }
    }
    return { label: 'Selesai', color: 'bg-green-600', wa: false, text: '' }
  }
  const doAction = (o, e) => {
    // Pelanggan WAJIB menghubungi dulu → cegah kasir chat duluan (risiko WA ke-banned).
    if (o.status === 'baru' && !o.contacted && !contacted.has(o.id)) return
    // Cegah corndog dibuat kepagian: saat "Konfirmasi Terima" pesanan AMBIL yang
    // jam ambilnya masih jauh, minta konfirmasi dulu.
    if (o.status === 'baru' && o.method !== 'maxim') {
      const mins = minsUntil(o.schedule)
      if (mins != null && mins > LEAD_MIN && !window.confirm(`Jam ambil ${o.schedule} masih ${mins} menit lagi.\nBikin sekarang berisiko corndog dingin (sebaiknya buat sekitar ${shiftHHMM(o.schedule, -15)}).\n\nTetap proses sekarang?`)) return
    }
    const a = stageAction(o)
    // Pesanan baru → diproses (masuk antrean masak): lempar bola ke tombol Antrean Masak.
    if (o.status === 'baru' && e && masakRef.current) { flyBall(e.clientX, e.clientY, masakRef.current, { color: '#2563eb' }); pulse(masakRef.current) }
    if (a.wa) {
      const url = `https://wa.me/${waIntl(o.wa)}?text=${encodeURIComponent(a.text)}`
      window.open(url, '_blank', 'noopener')
    }
    advanceOrder(o.id)
  }

  const shown = mine
    .filter((o) => (tab === 'aktif' ? o.status !== 'selesai' : o.status === 'selesai'))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) // FIFO by entry time

  const omzetOnline = mine.reduce((s, o) => s + (o.total || 0), 0)

  return (
    <div className="bg-background text-on-surface min-h-screen">
      {/* TopAppBar — same shape as Walk-in for consistent navigation */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center gap-2 px-3 sm:px-margin-page h-min-tap-target bg-primary shadow-md text-on-primary">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <span className="font-display-lg text-lg sm:text-headline-lg font-black tracking-tighter">CORNEY</span>
          <div className="hidden md:block h-6 w-px bg-on-primary/20 mx-2" />
          <span className="hidden md:inline font-label-lg text-label-lg text-on-primary/90 truncate">Cabang: {branch.name}</span>
        </div>
        <nav className="flex gap-1 sm:gap-6 h-full shrink-0">
          <button onClick={() => navigate('/ops/kasir/jualan')} className="h-full flex items-center px-2 sm:px-4 text-on-primary/80 font-medium hover:bg-primary-container/20 active:scale-95 transition-all whitespace-nowrap">
            Walk-in
          </button>
          <button className="relative h-full flex items-center px-2 sm:px-4 text-secondary-container font-bold border-b-4 border-secondary-container pb-1 active:scale-95 transition-all whitespace-nowrap">
            <span className="hidden sm:inline">Order&nbsp;</span>Online
            {newCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold h-5 min-w-5 px-1 flex items-center justify-center rounded-full border-2 border-primary">{newCount}</span>}
          </button>
        </nav>
        <div className="flex items-center gap-1 sm:gap-4 shrink-0">
          <button ref={masakRef} onClick={() => navigate('/ops/kasir/masak')} className="flex items-center gap-2 bg-on-primary/10 hover:bg-on-primary/20 px-3 py-2 rounded-xl font-label-lg transition-colors">
            <Icon name="outdoor_grill" /> <span className="hidden sm:inline">Antrean Masak</span>
            {(cook.frying > 0 || cook.queued > 0) && (
              <span className="flex items-center gap-1">
                {cook.frying > 0 && <span className="inline-flex items-center gap-0.5 bg-orange-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"><Icon name="local_fire_department" className="!text-[12px]" />{cook.frying}</span>}
                {cook.queued > 0 && <span className="inline-flex items-center gap-0.5 bg-on-primary/25 text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full"><Icon name="schedule" className="!text-[12px]" />{cook.queued}</span>}
              </span>
            )}
          </button>
          <div className="text-right hidden sm:block">
            <p className="font-headline-md text-headline-md leading-none">{clock.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-[10px] font-bold tracking-widest opacity-70 uppercase">{clock.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="p-2 hover:bg-primary-container/20 rounded-xl"><Icon name="more_vert" /></button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-white text-on-surface rounded-xl shadow-xl border border-outline-variant z-50 overflow-hidden">
                  <button onClick={() => { setMenuOpen(false); navigate('/ops/kasir/jualan') }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"><Icon name="point_of_sale" className="text-on-surface-variant" /> Walk-in</button>
                  <button onClick={() => { setMenuOpen(false); navigate('/ops/kasir/riwayat') }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"><Icon name="receipt_long" className="text-on-surface-variant" /> Riwayat Transaksi</button>
                  <button onClick={() => { setMenuOpen(false); navigate('/ops/kasir/closing/belanja') }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container text-left"><Icon name="nightlight" className="text-primary" /> Tutup Hari</button>
                  <button onClick={() => { setMenuOpen(false); handleLogout() }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-error-container hover:text-on-error-container text-left border-t border-outline-variant"><Icon name="logout" /> Logout</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="pt-min-tap-target min-h-screen flex flex-col">
        {/* Sub-tabs + auto status line */}
        <div className="px-4 sm:px-margin-page pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex bg-surface-container rounded-full p-1">
            {[['aktif', 'Aktif'], ['selesai', 'Selesai']].map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-5 py-2 rounded-full font-label-lg text-label-lg transition-all ${tab === k ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>{lbl}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-label-md text-on-surface-variant">
            <Icon name="sync" className="!text-[18px] text-green-600" /> Update otomatis aktif
            <span className="hidden sm:inline">· Online hari ini: <strong className="text-on-surface">{fmtRp(omzetOnline)}</strong></span>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-10 text-center">
            <Icon name="receipt_long" className="!text-6xl opacity-25" />
            <p className="mt-3 font-medium">{tab === 'aktif' ? 'Belum ada order online aktif.' : 'Belum ada order selesai hari ini.'}</p>
            <p className="text-sm opacity-70">Order yang sudah dibayar akan muncul di sini otomatis.</p>
          </div>
        ) : (
          <div className="px-4 sm:px-margin-page pb-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {shown.map((o) => {
              const isNew = o.status === 'baru'
              const isProc = o.status === 'diproses'
              const isReady = o.status === 'siap'
              const isDone = o.status === 'selesai'
              const wasContacted = o.contacted || contacted.has(o.id)
              const blockNew = isNew && !wasContacted // belum dihubungi pelanggan → kunci
              const action = stageAction(o)
              return (
                <div key={o.id} className={`bg-surface-container-lowest rounded-[14px] p-padding-card flex flex-col border-2 transition-all ${isNew ? 'border-secondary-container/40 shadow-[0_0_20px_2px_rgba(255,199,44,0.3)]' : 'border-outline-variant shadow-md'}`}>
                  {/* Head: no + PIN, method + time */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-headline-md text-headline-md text-on-surface">#{String(o.no).padStart(3, '0')}</h3>
                      <div className="mt-1 inline-flex items-center px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-label-md font-bold">PIN {o.pin}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-3 py-1 rounded-full text-label-md font-bold ${o.method === 'maxim' ? 'bg-secondary-fixed-dim text-on-secondary-fixed' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                        {o.method === 'maxim' ? 'Maxim' : `Ambil · ${o.schedule}`}
                      </span>
                      <span className="text-label-md text-on-surface-variant">{minsAgo(o.createdAt)}</span>
                    </div>
                  </div>

                  {/* Jadwal ambil — cegah buat kepagian (hanya Ambil berjadwal, belum selesai) */}
                  {o.method !== 'maxim' && o.schedule && !isDone && (() => {
                    const mins = minsUntil(o.schedule)
                    if (mins == null) return null
                    const early = mins > LEAD_MIN
                    const overdue = mins < 0
                    return (
                      <div className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-label-md font-bold ${early ? 'bg-amber-50 text-amber-800 border-amber-200' : overdue ? 'bg-error-container text-error border-error/30' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        <Icon name={early ? 'hourglass_top' : overdue ? 'priority_high' : 'soup_kitchen'} fill className="!text-[18px]" />
                        <span className="leading-snug">{early ? `Jangan buat dulu — jam ambil ${o.schedule} (${mins} mnt lagi). Buat ~${shiftHHMM(o.schedule, -15)}.` : overdue ? `Lewat jam ambil ${o.schedule} (${Math.abs(mins)} mnt lalu)` : `Waktunya buat — ambil jam ${o.schedule}`}</span>
                      </div>
                    )
                  })()}

                  {/* Status chip */}
                  {isNew && (
                    <div className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border ${wasContacted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-[#fff7e6] text-[#8a5b00] border-[#ffd591]'}`}>
                      <Icon name={wasContacted ? 'check_circle' : 'schedule'} className="!text-[18px]" />
                      <span className="text-label-md font-bold">{wasContacted ? 'Sudah dihubungi' : 'Menunggu pelanggan menghubungi'}</span>
                    </div>
                  )}
                  {isProc && <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200"><Icon name="restaurant" className="!text-[18px]" /><span className="text-label-md font-bold">Diproses</span></div>}
                  {isReady && <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200"><Icon name="check_circle" className="!text-[18px]" /><span className="text-label-md font-bold">Siap diambil / antar</span></div>}
                  {isDone && <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-surface-container text-on-surface-variant rounded-lg border border-outline-variant"><Icon name="task_alt" className="!text-[18px]" /><span className="text-label-md font-bold">Selesai</span></div>}

                  <div className="space-y-3 flex-1">
                    {/* Customer WA + salin nomor */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary shrink-0"><Icon name="call" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-label-md text-on-surface-variant">WhatsApp · {o.name || 'Pelanggan'}</p>
                        <p className="text-body-md font-bold">{waPretty(o.wa)}</p>
                        {blockNew && <p className="text-[11px] text-error font-bold leading-snug mt-0.5">Belum di-WA pelanggan. Mendesak? Salin nomor → WA manual.</p>}
                      </div>
                      <button onClick={() => copyWa(o)} className={`shrink-0 h-9 px-3 rounded-lg font-label-md flex items-center gap-1 active:scale-95 ${copiedId === o.id ? 'bg-green-600 text-white' : 'bg-surface-container text-on-surface'}`}>
                        <Icon name={copiedId === o.id ? 'check' : 'content_copy'} className="!text-[16px]" /> {copiedId === o.id ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                    {o.method === 'maxim' && o.address && (
                      <div className="flex items-start gap-2 text-label-md text-on-surface-variant"><Icon name="location_on" className="!text-[18px] text-primary shrink-0" /><span className="leading-snug">{o.address}</span></div>
                    )}

                    {/* Order */}
                    <div className="p-3 bg-surface-container rounded-lg border border-outline-variant">
                      <p className="text-label-md text-on-surface-variant mb-1">Pesanan</p>
                      <div className="space-y-0.5">
                        {o.lines.map((l) => (
                          <p key={l.sig} className="text-body-md font-bold leading-snug">
                            {l.qty}x {menuName(l.menuId)}
                            {sauceLabel(l.sauces) && <span className="font-normal text-on-surface-variant text-label-md"> · {sauceLabel(l.sauces)}</span>}
                          </p>
                        ))}
                      </div>
                      <div className="mt-3 pt-2 border-t border-outline-variant flex justify-between items-center">
                        <span className="text-body-md font-bold text-primary">{fmtRp(o.total)}</span>
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[12px] font-bold">Lunas (QRIS)</span>
                      </div>
                    </div>

                    {/* Manual "sudah dihubungi" (only meaningful while baru) */}
                    {isNew && (
                      <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input type="checkbox" checked={wasContacted} onChange={(e) => setContacted((prev) => { const n = new Set(prev); e.target.checked ? n.add(o.id) : n.delete(o.id); return n })} className="w-5 h-5 accent-primary rounded" />
                        <span className="text-label-md text-on-surface-variant">Tandai sudah dihubungi</span>
                      </label>
                    )}
                  </div>

                  {/* Staged action */}
                  {!isDone && (
                    <div className="mt-5">
                      <button onClick={(e) => doAction(o, e)} disabled={blockNew} className={`w-full h-min-tap-target ${blockNew ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed' : `${action.color} text-white active:scale-95`} rounded-[14px] font-bold shadow-md transition-all flex items-center justify-center gap-2`}>
                        {blockNew ? <Icon name="lock" /> : action.wa && <Icon name="chat" />} {blockNew ? 'Tunggu pelanggan hubungi' : action.label}
                      </button>
                      {!blockNew && action.wa && <p className="text-center text-[11px] text-on-surface-variant mt-2 italic">buka WA, pesan terketik otomatis · status maju otomatis</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
