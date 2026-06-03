import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtRp, PARENT_FILLINGS } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import { addBranch, updateBranch, toggleBranchActive } from '../../store/master.js'
import { useParStock } from '../../store/useParStock.js'
import { parOf, setPar } from '../../store/parstock.js'
import { isSupabase } from '../../lib/backend.js'
import { adminResetPasswordKasir, adminCreateKasir, MIN_PASSWORD } from '../../auth/adminUsers.js'

// 2.3 — §3 Multi-cabang · Kelola Cabang. Ported from Stitch
// "manage_branches_desktop", made responsive (card grid + drawer). The left
// sidebar and the unrelated "Daftar Item Request Belanja" block (that's the
// supplier/shopping-request feature, §2.4) are stripped. PRD #8: nonaktif ≠
// hapus — historical reports keep the outlet reference.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const EMPTY = { name: '', address: '', wa: '', maps: '', maximName: '', kembalian: 200000, stopOnline: '21:30', closeBooth: '22:00', username: '', password: '', par: {} }

export default function OwnerBranches() {
  const navigate = useNavigate()
  const master = useMaster()
  useParStock() // langganan stok standar
  const branches = master?.branches || []

  const [editing, setEditing] = useState(null) // null | {} new | {id,...} edit
  const [form, setForm] = useState(EMPTY)
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const openNew = () => { setForm({ ...EMPTY, par: {} }); setEditing({}) }
  const openEdit = (b) => { setForm({ name: b.name, address: b.address, wa: b.wa, maps: b.maps || '', maximName: b.maximName || '', kembalian: b.kembalian ?? 200000, stopOnline: b.stopOnline, closeBooth: b.closeBooth, username: b.username || '', password: b.password || '', par: { ...parOf(b.id) } }); setEditing(b) }
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
              <div className={`flex flex-wrap gap-2 mb-4 ${b.active ? '' : 'opacity-50 grayscale'}`}>
                <div className="bg-primary/5 text-primary border border-primary/20 px-3 py-2 rounded-xl flex items-center gap-2"><Icon name="timer" className="text-[18px]" /><span className="text-label-md">Stop Online <strong>{b.stopOnline}</strong></span></div>
                <div className="bg-tertiary-fixed text-on-tertiary-fixed px-3 py-2 rounded-xl flex items-center gap-2"><Icon name="store" className="text-[18px]" /><span className="text-label-md">Tutup Booth <strong>{b.closeBooth}</strong></span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(b)} className="flex-grow bg-surface-variant text-on-surface py-3 rounded-xl font-label-lg hover:bg-outline-variant transition-colors flex items-center justify-center gap-2"><Icon name="edit" className="text-[20px]" /> Edit</button>
                <button onClick={() => toggleBranchActive(b.id)} title={b.active ? 'Nonaktifkan' : 'Aktifkan'} className={`w-[52px] h-[52px] border rounded-xl flex items-center justify-center transition-colors ${b.active ? 'border-outline text-error hover:bg-error-container/30' : 'border-green-500 text-green-600 hover:bg-green-50'}`}>
                  <Icon name={b.active ? 'block' : 'play_arrow'} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer className="pt-8 pb-2 text-center">
          <p className="text-label-md text-on-surface-variant flex items-center justify-center gap-2"><Icon name="info" className="text-[18px]" /> Nonaktif ≠ hapus. Data historis tetap utuh untuk laporan finansial.</p>
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
                      <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} type={showPwd ? 'text' : 'password'} autoCapitalize="none" placeholder={editing.id ? 'kosongkan = tidak diubah' : 'minimal 4 karakter'} className="w-full h-[52px] border border-outline pl-4 pr-12 rounded-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-label-md bg-surface-container-lowest" />
                      <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"><Icon name={showPwd ? 'visibility_off' : 'visibility'} /></button>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700 flex items-start gap-1 leading-snug"><Icon name="info" className="!text-[14px] mt-0.5 shrink-0" /> Tersimpan lokal di perangkat (Fase 2) — cukup untuk pemisahan login antar-cabang. Keamanan penuh saat sistem pusat aktif (TAHAP 4).</p>
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
    </div>
  )
}
