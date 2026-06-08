import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtRp, PARENT_FILLINGS } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import { addBranch, updateBranch, toggleBranchActive, deleteBranch } from '../../store/master.js'
import { useParStock } from '../../store/useParStock.js'
import { parOf, setPar } from '../../store/parstock.js'
import { isSupabase } from '../../lib/backend.js'
import { adminResetPasswordKasir, adminCreateKasir, adminDeleteKasir, MIN_PASSWORD } from '../../auth/adminUsers.js'
import { useBranchStatus } from '../../store/useBranchStatus.js'
import { setBranchOpenFor } from '../../store/branchStatus.js'
import ImageUploadButton from '../../app/ImageUploadButton.jsx'

// 2.3 — §3 Multi-cabang · Kelola Cabang. Ported from Stitch
// "manage_branches_desktop", made responsive (card grid + drawer). The left
// sidebar and the unrelated "Daftar Item Request Belanja" block (that's the
// supplier/shopping-request feature, §2.4) are stripped. PRD #8: nonaktif ≠
// hapus — historical reports keep the outlet reference.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const EMPTY = { name: '', address: '', wa: '', maps: '', coord: '', qrisImg: '', maximName: '', kembalian: 200000, stopOnline: '21:30', closeBooth: '22:00', username: '', password: '', par: {} }

export default function OwnerBranches() {
  const navigate = useNavigate()
  const master = useMaster()
  useParStock() // langganan stok standar
  const bstatus = useBranchStatus() // status buka Toko Online (realtime, lintas perangkat)
  const branches = master?.branches || []
  const todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()

  const [editing, setEditing] = useState(null) // null | {} new | {id,...} edit
  const [form, setForm] = useState(EMPTY)
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  // Hapus cabang (permanen) — konfirmasi ketik nama.
  const [delTarget, setDelTarget] = useState(null) // branch yang akan dihapus
  const [delText, setDelText] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState('')

  const doDelete = async () => {
    if (!delTarget) return
    setDelErr('')
    setDelBusy(true)
    // Hapus akun kasir di server dulu (mode Supabase). Idempoten.
    if (isSupabase()) {
      const res = await adminDeleteKasir(delTarget.id)
      if (!res.ok) { setDelBusy(false); setDelErr('Gagal hapus akun kasir di server: ' + res.error); return }
    }
    deleteBranch(delTarget.id) // buang entitas + konfig (laporan historis TETAP)
    setDelBusy(false); setDelTarget(null); setDelText('')
  }

  const openNew = () => { setForm({ ...EMPTY, par: {} }); setEditing({}) }
  const openEdit = (b) => { setForm({ name: b.name, address: b.address, wa: b.wa, maps: b.maps || '', coord: b.coord || '', qrisImg: b.qrisImg || '', maximName: b.maximName || '', kembalian: b.kembalian ?? 200000, stopOnline: b.stopOnline, closeBooth: b.closeBooth, username: b.username || '', password: b.password || '', par: { ...parOf(b.id) } }); setEditing(b) }
  const close = () => { setEditing(null); setSaveErr(''); setBusy(false) }
  const setParField = (pid, v) => setForm((f) => ({ ...f, par: { ...f.par, [pid]: Math.max(0, Number(String(v).replace(/\D/g, '')) || 0) } }))
  const applyPar = (id) => PARENT_FILLINGS.forEach((p) => setPar(id, p.id, form.par?.[p.id] || 0))
  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaveErr('')
    if (editing?.id) {
      const data = { ...form }
      if (!data.password) delete data.password // kosong saat edit → password lama tetap
      if (!data.username) delete data.username // kosong → username lama tetap
      updateBranch(editing.id, data); applyPar(editing.id)
      // Mode Supabase: reset password kasir cabang ini di Supabase Auth.
      if (isSupabase() && form.password) {
        if (form.password.length < MIN_PASSWORD) { setSaveErr(`Password kasir minimal ${MIN_PASSWORD} karakter.`); return }
        setBusy(true)
        const res = await adminResetPasswordKasir(editing.id, form.password)
        setBusy(false)
        if (!res.ok) { setSaveErr('Tersimpan lokal, tapi gagal set password di server: ' + res.error); return }
      }
    } else {
      const b = addBranch(form)
      if (b) {
        applyPar(b.id)
        // Mode Supabase: buat akun kasir cabang baru via Edge admin-users.
        if (isSupabase()) {
          const pw = form.password || '123456'
          if (pw.length < MIN_PASSWORD) { setSaveErr(`Password kasir minimal ${MIN_PASSWORD} karakter.`); return }
          setBusy(true)
          const res = await adminCreateKasir(b.id, pw, 'Kasir ' + b.name)
          setBusy(false)
          if (!res.ok) { setSaveErr('Cabang tersimpan, tapi gagal buat akun kasir: ' + res.error); return }
        }
      }
    }
    close()
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary shadow-md shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[64px] max-w-6xl mx-auto">
          <button onClick={() => navigate('/ops/owner')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-95 shrink-0"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-md text-headline-md leading-tight flex-1">Kelola Cabang</h1>
          <button onClick={openNew} className="bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all shrink-0">
            <Icon name="add" /> <span className="hidden sm:inline">Tambah Cabang</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div key={b.id} className={`bg-surface-container-lowest p-padding-card rounded-[14px] shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-outline-variant/40 flex flex-col ${b.active ? '' : 'opacity-80'}`}>
              <div className="flex justify-between items-start mb-4 gap-2">
                <h3 className="font-headline-md text-headline-md text-on-surface leading-tight">{b.name}</h3>
                {b.active ? (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Aktif</span>
                ) : (
                  <span className="bg-error-container text-error px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0"><span className="w-2 h-2 bg-error rounded-full" /> Nonaktif</span>
                )}
              </div>
              <div className="space-y-2 mb-4 flex-grow">
                <div className="flex items-start gap-2 text-on-surface-variant"><Icon name="location_on" className="text-[18px] shrink-0" /><p className="text-label-md">{b.address}</p></div>
                <div className="flex items-center gap-2 text-on-surface-variant"><Icon name="call" className="text-[18px] shrink-0" /><p className="text-label-md">{b.wa} (WA Business)</p></div>
                <div className="flex items-center gap-2 text-on-surface-variant"><Icon name="two_wheeler" className="text-[18px] shrink-0" /><p className="text-label-md">Maxim: <strong>{b.maximName || b.name}</strong></p></div>
                <div className="flex items-center gap-2 text-on-surface-variant"><Icon name="savings" className="text-[18px] shrink-0" /><p className="text-label-md">Kembalian: <strong>{fmtRp(b.kembalian ?? 0)}</strong></p></div>
              </div>
              <div className={`flex flex-wrap gap-2 mb-3 ${b.active ? '' : 'opacity-50 grayscale'}`}>
                <div className="bg-primary/5 text-primary border border-primary/20 px-3 py-2 rounded-xl flex items-center gap-2"><Icon name="timer" className="text-[18px]" /><span className="text-label-md">Stop Online <strong>{b.stopOnline}</strong></span></div>
                <div className="bg-tertiary-fixed text-on-tertiary-fixed px-3 py-2 rounded-xl flex items-center gap-2"><Icon name="store" className="text-[18px]" /><span className="text-label-md">Tutup Booth <strong>{b.closeBooth}</strong></span></div>
              </div>

              {/* Saklar manual Toko Online (override kasir) — langsung ke customer realtime */}
              {isSupabase() && (() => {
                const st = bstatus[b.id]
                const isOpen = !!st?.open && st.openDate === todayISO
                return (
                  <div className="flex items-center justify-between gap-2 mb-4 px-3 py-2.5 rounded-xl border border-outline-variant/60 bg-surface">
                    <span className="text-label-md flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-error'}`} />
                      Toko Online: <strong className={isOpen ? 'text-green-700' : 'text-error'}>{isOpen ? 'BUKA' : 'TUTUP'}</strong>
                    </span>
                    <button onClick={() => setBranchOpenFor(b.id, !isOpen)} className={`px-4 h-9 rounded-lg font-bold text-[13px] active:scale-95 transition-transform shrink-0 ${isOpen ? 'bg-error text-on-error' : 'bg-green-600 text-white'}`}>
                      {isOpen ? 'Tutup' : 'Buka'}
                    </button>
                  </div>
                )
              })()}
              <div className="flex gap-2">
                <button onClick={() => openEdit(b)} className="flex-grow bg-surface-variant text-on-surface py-3 rounded-xl font-label-lg hover:bg-outline-variant transition-colors flex items-center justify-center gap-2"><Icon name="edit" className="text-[20px]" /> Edit</button>
                <button onClick={() => toggleBranchActive(b.id)} title={b.active ? 'Nonaktifkan (sembunyikan, data tetap)' : 'Aktifkan'} className={`w-[52px] h-[52px] border rounded-xl flex items-center justify-center transition-colors ${b.active ? 'border-outline text-amber-600 hover:bg-amber-50' : 'border-green-500 text-green-600 hover:bg-green-50'}`}>
                  <Icon name={b.active ? 'visibility_off' : 'play_arrow'} />
                </button>
                <button onClick={() => { setDelTarget(b); setDelText(''); setDelErr('') }} title="Hapus cabang permanen" className="w-[52px] h-[52px] border border-outline text-error hover:bg-error-container/40 rounded-xl flex items-center justify-center transition-colors">
                  <Icon name="delete" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer className="pt-8 pb-2 text-center space-y-1">
          <p className="text-label-md text-on-surface-variant flex items-center justify-center gap-2"><Icon name="visibility_off" className="text-[18px]" /> <b>Nonaktif</b> = sembunyikan dari operasional, data tetap & bisa diaktifkan lagi.</p>
          <p className="text-label-md text-on-surface-variant flex items-center justify-center gap-2"><Icon name="delete" className="text-[18px]" /> <b>Hapus</b> = cabang & akun kasir hilang permanen. Laporan/transaksi yang sudah ada <b>tetap tersimpan</b> di Master Laporan sampai kamu <b>Reset Bulan</b>.</p>
        </footer>
      </main>

      {/* Add / Edit drawer */}
      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-stretch justify-center sm:justify-end" onClick={close}>
          <div className="w-full sm:w-[420px] h-full bg-surface-container-lowest shadow-2xl flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-outline-variant flex justify-between items-center sticky top-0 bg-surface-container-lowest z-10">
              <h2 className="font-headline-md text-headline-md text-on-surface">{editing.id ? 'Edit Cabang' : 'Tambah Cabang'}</h2>
              <button onClick={close} className="p-2 hover:bg-surface-variant rounded-full"><Icon name="close" /></button>
            </div>

            <form onSubmit={save} className="p-5 space-y-7 flex-1">
              {/* Identitas */}
              <div className="space-y-3">
                <h3 className="font-label-lg text-primary flex items-center gap-2"><Icon name="badge" /> Identitas Cabang</h3>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1">Nama Cabang</label>
                  <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="CORNEY Sepinggan" type="text" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1">Alamat Lengkap</label>
                  <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows="3" placeholder="Jl. ..." className="w-full border border-outline p-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1">WA Business</label>
                  <input value={form.wa} onChange={(e) => setForm((f) => ({ ...f, wa: e.target.value }))} placeholder="628120000000" type="tel" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1 flex items-center gap-1"><Icon name="location_on" className="!text-[16px]" /> Link Google Maps</label>
                  <input value={form.maps} onChange={(e) => setForm((f) => ({ ...f, maps: e.target.value }))} placeholder="https://maps.app.goo.gl/..." type="url" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                  <p className="text-[11px] text-on-surface-variant ml-1 leading-snug">Link lokasi cabang. Dikirim otomatis ke customer <strong>ambil sendiri</strong> lewat WA saat pesanan siap.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1 flex items-center gap-1"><Icon name="my_location" className="!text-[16px]" /> Koordinat GPS (cabang terdekat)</label>
                  <input value={form.coord} onChange={(e) => setForm((f) => ({ ...f, coord: e.target.value }))} placeholder="-1.267500, 116.894500" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest font-mono" />
                  <div className="mt-1 rounded-xl bg-secondary-container/40 border border-secondary/30 p-3">
                    <p className="text-[12px] font-bold text-on-surface flex items-center gap-1 mb-1.5"><Icon name="help" className="!text-[15px] text-primary" /> Cara ambil koordinat dari Google Maps</p>
                    <ol className="text-[11px] text-on-surface-variant leading-relaxed list-decimal ml-4 space-y-0.5">
                      <li>Buka <strong>Google Maps</strong>, cari lokasi cabang.</li>
                      <li><strong>Tekan &amp; tahan</strong> tepat di titik lokasi cabang → muncul pin merah.</li>
                      <li>Koordinat muncul (mis. <span className="font-mono">-1.267500, 116.894500</span>) — di kolom pencarian / kartu bawah.</li>
                      <li><strong>Ketuk angka itu</strong> untuk menyalin, lalu <strong>tempel</strong> di kolom di atas.</li>
                    </ol>
                    <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-primary"><Icon name="open_in_new" className="!text-[14px]" /> Buka Google Maps</a>
                  </div>
                  <p className="text-[11px] text-on-surface-variant ml-1 leading-snug">Dipakai app customer untuk mengurutkan <strong>cabang terdekat</strong> dari lokasinya. Format: <span className="font-mono">lat,lng</span>.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1 flex items-center gap-1"><Icon name="qr_code_2" className="!text-[16px]" /> Gambar QRIS GoPay</label>
                  <ImageUploadButton value={form.qrisImg} onChange={(url) => setForm((f) => ({ ...f, qrisImg: url }))} label="Upload QRIS GoPay" />
                  <input value={form.qrisImg} onChange={(e) => setForm((f) => ({ ...f, qrisImg: e.target.value }))} placeholder="atau tempel URL gambar https://…" type="url" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                  {form.qrisImg && <img src={form.qrisImg} alt="QRIS GoPay" className="mt-1 w-32 h-32 object-contain rounded-xl border border-outline-variant bg-white p-1" />}
                  <p className="text-[11px] text-on-surface-variant ml-1 leading-snug">Muncul di kasir saat metode <strong>QRIS GoPay</strong> dipilih — pelanggan scan gambar ini. Pakai screenshot QR GoPay/QRIS statis cabang.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1 flex items-center gap-1"><Icon name="two_wheeler" className="!text-[16px]" /> Nama Lokasi di Maxim</label>
                  <input value={form.maximName} onChange={(e) => setForm((f) => ({ ...f, maximName: e.target.value }))} placeholder="Corney Sepinggan" type="text" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                  <p className="text-[11px] text-on-surface-variant ml-1 leading-snug">Nama yang diketik customer sebagai <strong>titik penjemputan</strong> di aplikasi Maxim. Kosongkan = pakai nama cabang.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1 flex items-center gap-1"><Icon name="savings" className="!text-[16px]" /> Standar Uang Kembalian (Modal Awal)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">Rp</span>
                    <input value={form.kembalian ? Number(form.kembalian).toLocaleString('id-ID') : ''} onChange={(e) => setForm((f) => ({ ...f, kembalian: Number(e.target.value.replace(/\D/g, '')) || 0 }))} inputMode="numeric" placeholder="200.000" className="w-full h-[52px] pl-12 pr-4 rounded-[14px] border border-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                  </div>
                  <p className="text-[11px] text-on-surface-variant ml-1 leading-snug">Modal laci awal yang dipakai kasir saat Buka Kas (otomatis terisi).</p>
                </div>
                <div className="bg-surface-container p-4 rounded-[14px] space-y-3 border-l-4 border-primary">
                  <div className="flex items-center gap-2 text-on-surface font-bold text-label-md"><Icon name="lock" className="text-[18px]" /> Akun Login Cabang (Kasir)</div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1">Username</label>
                    <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} autoCapitalize="none" placeholder="contoh: corney-sepinggan" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                    {!editing.id && <p className="text-[11px] text-on-surface-variant ml-1">Dipakai kasir untuk masuk. Kosongkan = dibuat otomatis.</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1">Password</label>
                    <div className="relative">
                      <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} type={showPwd ? 'text' : 'password'} autoCapitalize="none" placeholder={editing.id ? 'kosongkan = tidak diubah' : `minimal ${MIN_PASSWORD} karakter`} className="w-full h-[52px] border border-outline pl-4 pr-12 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                      <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"><Icon name={showPwd ? 'visibility_off' : 'visibility'} /></button>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700 flex items-start gap-1 leading-snug"><Icon name="info" className="!text-[14px] mt-0.5 shrink-0" /> {isSupabase() ? `Password disimpan AMAN di server (Supabase Auth), minimal ${MIN_PASSWORD} karakter. Begitu disimpan, kasir langsung pakai password baru saat login berikutnya.` : 'Tersimpan lokal di perangkat (mode lokal) — cukup untuk pemisahan login antar-cabang.'}</p>
                </div>
              </div>

              {/* Jam operasional */}
              <div className="space-y-3">
                <h3 className="font-label-lg text-primary flex items-center gap-2"><Icon name="schedule" /> Jam Operasional</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1">Stop Order Online</label>
                    <input value={form.stopOnline} onChange={(e) => setForm((f) => ({ ...f, stopOnline: e.target.value }))} type="time" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-on-surface-variant uppercase ml-1">Tutup Booth</label>
                    <input value={form.closeBooth} onChange={(e) => setForm((f) => ({ ...f, closeBooth: e.target.value }))} type="time" className="w-full h-[52px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                  </div>
                </div>
                <div className="flex gap-2 p-3 bg-secondary-fixed/20 rounded-xl border border-secondary-fixed">
                  <Icon name="lightbulb" className="text-secondary text-[20px] shrink-0" />
                  <p className="text-xs text-on-secondary-fixed-variant leading-relaxed"><strong>Tips:</strong> tutup online lebih awal agar antrean habis sebelum booth benar-benar tutup.</p>
                </div>
              </div>

              {/* Stok Standar per isian — digabung ke sini (sumber: store parstock) */}
              <div className="space-y-3">
                <h3 className="font-label-lg text-primary flex items-center gap-2"><Icon name="inventory_2" /> Stok Standar (per isian)</h3>
                <p className="text-[11px] text-on-surface-variant -mt-1 ml-1 leading-snug">Jumlah stok yang harus ada tiap pagi. Operasional mengirim = Stok Standar − sisa.</p>
                <div className="grid grid-cols-2 gap-3">
                  {PARENT_FILLINGS.map((p) => (
                    <div key={p.id} className="space-y-1">
                      <label className="text-[12px] font-bold text-on-surface-variant ml-1">{p.name}</label>
                      <input inputMode="numeric" value={form.par?.[p.id] ? Number(form.par[p.id]).toLocaleString('id-ID') : ''} onChange={(e) => setParField(p.id, e.target.value)} placeholder="0" className="w-full h-[48px] border border-outline px-4 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-headline-md text-center bg-surface-container-lowest" />
                    </div>
                  ))}
                </div>
              </div>
            </form>

            <div className="p-5 bg-surface-container-lowest border-t border-outline-variant sticky bottom-0 space-y-3">
              {saveErr && <p className="text-[12px] text-error flex items-start gap-1.5"><Icon name="error" className="!text-[16px] mt-0.5 shrink-0" /> {saveErr}</p>}
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={close} disabled={busy} className="h-[52px] border border-outline text-on-surface-variant rounded-[14px] font-label-lg hover:bg-surface-variant transition-colors disabled:opacity-50">Batal</button>
                <button onClick={save} disabled={busy} className="h-[52px] bg-primary text-on-primary rounded-[14px] font-label-lg shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi HAPUS cabang — ketik nama persis untuk mencegah salah hapus */}
      {delTarget && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4" onClick={() => !delBusy && setDelTarget(null)}>
          <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 bg-error-container/50 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-error text-on-error flex items-center justify-center shrink-0"><Icon name="delete_forever" /></div>
              <div>
                <h2 className="font-headline-md text-error leading-tight">Hapus cabang permanen?</h2>
                <p className="text-[12px] text-on-surface-variant">{delTarget.name}</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-[13px] text-on-surface leading-snug bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
                <p className="flex items-start gap-1.5"><Icon name="warning" className="!text-[16px] text-amber-600 mt-0.5 shrink-0" /> Cabang & <b>akun kasir-nya</b> akan dihapus permanen. Kasir tak bisa login lagi.</p>
                <p className="flex items-start gap-1.5"><Icon name="check_circle" className="!text-[16px] text-green-600 mt-0.5 shrink-0" /> <b>Laporan & transaksi yang sudah ada TETAP tersimpan</b> di Master Laporan — sampai kamu klik <b>Reset Bulan</b>.</p>
              </div>
              <div>
                <label className="text-[12px] font-bold text-on-surface-variant">Ketik nama cabang untuk konfirmasi:</label>
                <input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder={delTarget.name} autoCapitalize="none" className="w-full h-[48px] mt-1 px-3 rounded-xl border border-outline focus:border-error focus:ring-1 focus:ring-error outline-none bg-surface-container-lowest text-sm" />
              </div>
              {delErr && <p className="text-[12px] text-error flex items-start gap-1.5"><Icon name="error" className="!text-[16px] mt-0.5 shrink-0" /> {delErr}</p>}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={() => setDelTarget(null)} disabled={delBusy} className="h-[50px] border border-outline text-on-surface-variant rounded-xl font-label-lg hover:bg-surface-variant disabled:opacity-50">Batal</button>
                <button onClick={doDelete} disabled={delBusy || delText.trim().toLowerCase() !== (delTarget.name || '').trim().toLowerCase()} className="h-[50px] bg-error text-on-error rounded-xl font-label-lg shadow-lg active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  <Icon name="delete_forever" className="!text-[20px]" /> {delBusy ? 'Menghapus…' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
