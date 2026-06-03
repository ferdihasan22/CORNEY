import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useUsers } from '../../store/useUsers.js'
import { addUser, updateUser, toggleUserActive } from '../../store/users.js'
import { useRoleCreds } from '../../auth/useRoleCreds.js'
import { ROLE_META, setRoleCred } from '../../auth/roleAuth.js'
import { isSupabase } from '../../lib/backend.js'
import { adminResetPasswordRole, MIN_PASSWORD } from '../../auth/adminUsers.js'

const CRED_ROLES = ['owner', 'operasional', 'produksi', 'auditor', 'supplier']

// 2.6 — Manajemen User (Owner). CRUD staff accounts per role/branch. Deactivate ≠
// delete (PRD #8). Real auth/password reset via Supabase central system (TAHAP 4).
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const ROLES = [
  { id: 'kasir', label: 'Kasir', cls: 'bg-primary-fixed text-on-primary-fixed-variant', icon: 'point_of_sale', branchBound: true },
  { id: 'operasional', label: 'Operasional', cls: 'bg-blue-100 text-blue-700', icon: 'local_shipping', branchBound: false },
  { id: 'produksi', label: 'Produksi', cls: 'bg-secondary-container text-on-secondary-container', icon: 'factory', branchBound: false },
  { id: 'auditor', label: 'Auditor', cls: 'bg-green-100 text-green-700', icon: 'verified_user', branchBound: false },
]
const roleOf = (id) => ROLES.find((r) => r.id === id) || ROLES[0]
const branchName = (id) => BRANCHES.find((b) => b.id === id)?.name?.replace('CORNEY ', '') || '—'

const EMPTY = { name: '', role: 'kasir', branchId: '' }

export default function OwnerUsers() {
  const navigate = useNavigate()
  const users = useUsers() || []
  const creds = useRoleCreds() || {}
  const [showPwd, setShowPwd] = useState({})
  const [editing, setEditing] = useState(null) // null | {} new | user edit
  const [form, setForm] = useState(EMPTY)
  const [pwStatus, setPwStatus] = useState({}) // {role: 'saving'|'ok'|<pesan error>}

  // Mode Supabase: dorong password role saat ini ke Supabase Auth via Edge admin-users.
  const pushPwd = async (role) => {
    const pw = creds[role]?.password || ''
    if (pw.length < MIN_PASSWORD) { setPwStatus((s) => ({ ...s, [role]: `Password minimal ${MIN_PASSWORD} karakter.` })); return }
    setPwStatus((s) => ({ ...s, [role]: 'saving' }))
    const res = await adminResetPasswordRole(role, pw)
    setPwStatus((s) => ({ ...s, [role]: res.ok ? 'ok' : (res.error || 'Gagal menyimpan.') }))
  }

  const openNew = () => { setForm(EMPTY); setEditing({}) }
  const openEdit = (u) => { setForm({ name: u.name, role: u.role, branchId: u.branchId || '' }); setEditing(u) }
  const save = () => {
    if (!form.name.trim()) return
    const branchId = roleOf(form.role).branchBound ? form.branchId : ''
    if (editing?.id) updateUser(editing.id, { ...form, branchId })
    else addUser({ ...form, branchId })
    setEditing(null)
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-primary text-on-primary px-5 h-[64px] flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-md text-headline-md">Manajemen User</h1>
        </div>
        <button onClick={openNew} className="bg-secondary-container text-on-secondary-container px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 active:scale-95"><Icon name="person_add" className="!text-[20px]" /> <span className="hidden sm:inline">Tambah</span></button>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-3">
        {/* Akun & Password tiap PWA (selain Kasir yang per cabang) */}
        <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] overflow-hidden">
          <div className="bg-primary/5 px-4 py-3 border-b border-outline-variant/40">
            <h2 className="font-headline-md text-headline-md flex items-center gap-2"><Icon name="key" className="text-primary" /> Akun & Password PWA</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">Username & password login tiap aplikasi. Tersimpan otomatis saat diketik.</p>
          </div>
          <div className="divide-y divide-outline-variant/30">
            {CRED_ROLES.map((role) => {
              const m = ROLE_META[role]; const c = creds[role] || { username: '', password: '' }
              return (
                <div key={role} className="p-4">
                  <p className="font-bold flex items-center gap-2 mb-2"><Icon name={m.icon} className="text-primary !text-[20px]" /> {m.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase ml-1">Username</label>
                      <input value={c.username} onChange={(e) => setRoleCred(role, { username: e.target.value })} autoCapitalize="none" className="w-full h-11 mt-1 px-3 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase ml-1">Password</label>
                      <div className="relative mt-1">
                        <input value={c.password} onChange={(e) => setRoleCred(role, { password: e.target.value })} type={showPwd[role] ? 'text' : 'password'} className="w-full h-11 pl-3 pr-11 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" />
                        <button type="button" onClick={() => setShowPwd((s) => ({ ...s, [role]: !s[role] }))} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"><Icon name={showPwd[role] ? 'visibility_off' : 'visibility'} className="!text-[18px]" /></button>
                      </div>
                    </div>
                  </div>
                  {isSupabase() && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => pushPwd(role)} disabled={pwStatus[role] === 'saving'} className="px-3 py-2 rounded-xl bg-primary text-on-primary text-[12px] font-bold active:scale-95 disabled:opacity-50 flex items-center gap-1.5"><Icon name="cloud_upload" className="!text-[16px]" /> Set password di server</button>
                      {pwStatus[role] === 'saving' && <span className="text-[12px] text-on-surface-variant">menyimpan…</span>}
                      {pwStatus[role] === 'ok' && <span className="text-[12px] text-green-600 font-bold flex items-center gap-1"><Icon name="check_circle" className="!text-[15px]" /> Tersimpan di server</span>}
                      {pwStatus[role] && pwStatus[role] !== 'saving' && pwStatus[role] !== 'ok' && <span className="text-[12px] text-error">{pwStatus[role]}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="px-4 py-2.5 text-[11px] text-amber-700 flex items-start gap-1.5 border-t border-outline-variant/40"><Icon name="info" className="!text-[15px] mt-0.5 shrink-0" /> Tersimpan lokal (Fase 2) — cukup untuk pembagian akses. Keamanan penuh di TAHAP 4. Login <b>Kasir</b> diatur per cabang di <b>Kelola Cabang</b>.</p>
        </section>

        <h2 className="font-headline-md text-headline-md flex items-center gap-2 pt-2"><Icon name="groups" className="text-primary" /> Daftar Staf</h2>
        {users.map((u) => {
          const r = roleOf(u.role)
          return (
            <div key={u.id} className={`bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/40 shadow-[0_4px_16px_rgba(26,26,26,0.06)] flex items-center gap-3 ${u.active ? '' : 'opacity-60'}`}>
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center shrink-0"><Icon name={r.icon} className="text-primary" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-headline-md text-headline-md leading-tight">{u.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${r.cls}`}>{r.label}</span>
                  {r.branchBound && <span className="text-[12px] text-on-surface-variant">{branchName(u.branchId)}</span>}
                  {!u.active && <span className="text-[11px] font-bold text-error">Nonaktif</span>}
                </div>
              </div>
              <button onClick={() => openEdit(u)} className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant"><Icon name="edit" /></button>
              <button onClick={() => toggleUserActive(u.id)} title={u.active ? 'Nonaktifkan' : 'Aktifkan'} className={`w-10 h-10 rounded-full flex items-center justify-center ${u.active ? 'text-error hover:bg-error-container/40' : 'text-green-600 hover:bg-green-50'}`}><Icon name={u.active ? 'block' : 'play_arrow'} /></button>
            </div>
          )
        })}
        <p className="text-[12px] text-on-surface-variant/70 text-center pt-2 flex items-center justify-center gap-1.5"><Icon name="info" className="!text-[16px]" /> Nonaktif ≠ hapus. Reset password lewat sistem pusat.</p>
      </main>

      {editing && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl space-y-4">
            <h2 className="font-headline-md text-headline-md">{editing.id ? 'Edit User' : 'Tambah User'}</h2>
            <div><label className="text-[11px] font-bold text-on-surface-variant uppercase ml-1">Nama</label><input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama staf" className="w-full h-12 mt-1 px-4 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest" /></div>
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant uppercase ml-1">Peran</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ROLES.map((r) => <button key={r.id} onClick={() => setForm((f) => ({ ...f, role: r.id }))} className={`h-11 rounded-xl border-2 font-label-md transition-all ${form.role === r.id ? 'border-primary bg-primary-fixed text-primary' : 'border-outline-variant text-on-surface-variant'}`}>{r.label}</button>)}
              </div>
            </div>
            {roleOf(form.role).branchBound && (
              <div><label className="text-[11px] font-bold text-on-surface-variant uppercase ml-1">Cabang</label>
                <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))} className="w-full h-12 mt-1 px-3 rounded-xl border border-outline focus:border-primary outline-none bg-surface-container-lowest">
                  <option value="">— pilih cabang —</option>
                  {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 h-[52px] rounded-xl border border-outline text-on-surface-variant font-label-lg">Batal</button>
              <button onClick={save} className="flex-[2] h-[52px] rounded-xl bg-primary text-on-primary font-headline-md shadow-lg active:scale-[0.98]">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
