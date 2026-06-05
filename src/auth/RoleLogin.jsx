import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLE_META, credOf, setRoleSession, lockInfo, recordFail, clearLock } from './roleAuth.js'
import { isSupabase } from '../lib/backend.js'
import { signInRole, signInAuto } from './supabaseAuth.js'
import InstallPrompt from '../components/InstallPrompt.jsx'

// CORNEY — Layar login bersama untuk role tetap (Owner/Operasional/Produksi/Auditor).
// Username + password (dari Manajemen User), "Ingat Login", dan kunci 3x→10 menit.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

export default function RoleLogin({ role: fixedRole, roles }) {
  const navigate = useNavigate()
  // KANTOR: banyak peran berbagi 1 halaman → SATU login, peran DIDETEKSI OTOMATIS dari akun.
  const auto = Array.isArray(roles) && roles.length > 1
  const lockKey = auto ? 'kantor' : fixedRole
  const meta = auto
    ? { label: 'Kantor', home: '/', icon: 'corporate_fare' }
    : (ROLE_META[fixedRole] || { label: fixedRole, home: '/', icon: 'lock' })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [lock, setLock] = useState(() => lockInfo(lockKey))

  // Hitung mundur saat terkunci.
  useEffect(() => {
    if (!lock.locked) return
    const t = setInterval(() => { const i = lockInfo(lockKey); setLock(i); if (!i.locked) { clearInterval(t); setError('') } }, 1000)
    return () => clearInterval(t)
  }, [lock.locked, lockKey])

  async function handleSubmit(e) {
    e.preventDefault()
    const li = lockInfo(lockKey)
    if (li.locked) { setLock(li); return }

    if (auto) {
      // KANTOR — deteksi peran otomatis (tanpa pilih peran).
      let detected = null, errMsg = 'Username atau password salah.'
      if (isSupabase()) {
        const res = await signInAuto(password, roles)
        if (res.ok) detected = res.role; else errMsg = res.error || errMsg
      } else {
        detected = roles.find((r) => { const c = credOf(r); return username.trim().toLowerCase() === (c.username || '').toLowerCase() && password === c.password }) || null
      }
      if (detected) { clearLock(lockKey); setRoleSession(detected, remember); navigate(ROLE_META[detected]?.home || '/', { replace: true }); return }
      const after = recordFail(lockKey); setLock(after)
      setError(after.locked ? 'Salah 3 kali. Coba lagi nanti.' : errMsg); setPassword('')
      return
    }

    // Peran tetap (route login spesifik per-peran).
    if (isSupabase()) {
      const res = await signInRole(fixedRole, password)
      if (res.ok) { clearLock(lockKey); setRoleSession(fixedRole, remember); navigate(meta.home, { replace: true }) }
      else {
        const after = recordFail(lockKey); setLock(after)
        setError(after.locked ? 'Salah 3 kali. Coba lagi nanti.' : (res.error || 'Username atau password salah.'))
        setPassword('')
      }
      return
    }
    const c = credOf(fixedRole)
    if (username.trim().toLowerCase() === (c.username || '').toLowerCase() && password === c.password) {
      clearLock(lockKey); setRoleSession(fixedRole, remember); navigate(meta.home, { replace: true })
    } else {
      const after = recordFail(lockKey); setLock(after)
      setError(after.locked ? 'Salah 3 kali. Coba lagi nanti.' : 'Username atau password salah.')
      setPassword('')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-margin-page select-none bg-surface-container-lowest">
      <header className="flex flex-col items-center mb-10">
        <div className="relative mb-2">
          <h1 className="font-display-md text-display-md text-primary-container tracking-tighter">CORNEY</h1>
          <div className="h-1.5 w-1/3 bg-secondary-container absolute -bottom-1 left-0 rounded-full" />
        </div>
        <p className="font-label-md text-label-md text-tertiary-container tracking-wide">#CeritanyaBersamaCorney</p>
      </header>

      <main className="w-full max-w-[420px]">
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-8 shadow-[0_4px_16px_rgba(26,26,26,0.08)]">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-1 text-center flex items-center justify-center gap-2"><Icon name={meta.icon} /> Masuk {meta.label}</h2>
          <p className="text-center text-label-md text-on-surface-variant mb-7">{auto ? 'Owner · Operasional · Produksi · Auditor — peran terdeteksi otomatis' : `Akun ${meta.label} CORNEY`}</p>

          {lock.locked && (
            <div className="mb-5 bg-error-container/40 border border-error/40 rounded-xl p-3 text-center text-error">
              <p className="font-bold flex items-center justify-center gap-1.5"><Icon name="lock_clock" className="!text-[18px]" /> Terkunci sementara</p>
              <p className="text-label-md">Terlalu banyak percobaan. Coba lagi dalam <b className="tabular-nums">{mmss(lock.remainingMs)}</b></p>
            </div>
          )}

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2"><Icon name="person" className="text-[18px]" /> Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" disabled={lock.locked} className="w-full h-min-tap-target px-4 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none font-body-md text-body-md text-on-surface disabled:opacity-50" placeholder="username" type="text" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2"><Icon name="lock" className="text-[18px]" /> Password</label>
              <div className="relative">
                <input value={password} onChange={(e) => setPassword(e.target.value)} disabled={lock.locked} className="w-full h-min-tap-target pl-4 pr-12 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none font-body-md text-body-md text-on-surface disabled:opacity-50" placeholder="••••••••" type={show ? 'text' : 'password'} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary flex items-center justify-center h-10 w-10 rounded-full hover:bg-surface-container-high"><Icon name={show ? 'visibility_off' : 'visibility'} /></button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-5 h-5 accent-primary" />
              <span className="font-label-md text-label-md text-on-surface-variant">Ingat saya di perangkat ini</span>
            </label>

            {error && !lock.locked && <p className="text-center font-label-md text-label-md text-error">{error}</p>}

            <button type="submit" disabled={lock.locked} className="w-full h-min-tap-target bg-primary-container text-on-primary font-headline-md text-headline-md rounded-xl shadow-[0_8px_24px_rgba(181,3,3,0.2)] active:scale-95 transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-40 disabled:active:scale-100">Masuk</button>
          </form>

          <div className="mt-5 pt-4 border-t border-outline-variant/50">
            <InstallPrompt label="Instal Aplikasi" />
          </div>
        </div>
      </main>

      <footer className="mt-12 flex flex-col items-center gap-1 opacity-60">
        <p className="font-label-md text-label-md text-tertiary-container">CORNEY · {meta.label}</p>
      </footer>
    </div>
  )
}
