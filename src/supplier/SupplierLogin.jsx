import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupplierSession, setSupplierSession } from './session.js'
import { credOf, lockInfo, recordFail, clearLock } from '../auth/roleAuth.js'

// 3.1 — SUP-01 Login Portal Supplier. Username+password diatur Owner (Manajemen User).
// "Ingat Login" → sesi permanen (localStorage). Kunci 3x salah → tunggu 10 menit.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

export default function SupplierLogin() {
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [lock, setLock] = useState(() => lockInfo('supplier'))

  // Auto-masuk kalau sesi masih diingat.
  useEffect(() => {
    if (getSupplierSession()) navigate('/supplier/request', { replace: true })
  }, [navigate])

  // Hitung mundur saat terkunci.
  useEffect(() => {
    if (!lock.locked) return
    const t = setInterval(() => { const i = lockInfo('supplier'); setLock(i); if (!i.locked) { clearInterval(t); setError('') } }, 1000)
    return () => clearInterval(t)
  }, [lock.locked])

  const masuk = () => {
    const li = lockInfo('supplier')
    if (li.locked) { setLock(li); return }
    const c = credOf('supplier')
    if (id.trim().toLowerCase() === (c.username || '').toLowerCase() && pw === c.password) {
      clearLock('supplier'); setSupplierSession(id.trim(), remember); navigate('/supplier/request')
    } else {
      const after = recordFail('supplier'); setLock(after); setPw('')
      setError(after.locked ? 'Salah 3 kali. Coba lagi nanti.' : 'Username atau password salah.')
    }
  }

  return (
    <div className="bg-primary-container min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <div className="inline-block bg-white/15 text-on-primary-container font-display-md text-display-md px-6 py-2 rounded-2xl">CORNEY</div>
        <p className="text-on-primary-container/90 mt-3 font-label-lg uppercase tracking-widest text-[12px]">Portal Mitra Supplier</p>
      </div>

      <div className="w-full max-w-sm bg-surface rounded-[24px] p-6 shadow-2xl space-y-4">
        <h1 className="font-headline-lg text-headline-lg text-center">Masuk</h1>
        {lock.locked && (
          <div className="bg-error-container/40 border border-error/40 rounded-xl p-3 text-center text-error">
            <p className="font-bold flex items-center justify-center gap-1.5"><Icon name="lock_clock" className="!text-[18px]" /> Terkunci sementara</p>
            <p className="text-label-md">Terlalu banyak percobaan. Coba lagi dalam <b className="tabular-nums">{mmss(lock.remainingMs)}</b></p>
          </div>
        )}
        <div className="relative">
          <Icon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]" />
          <input value={id} onChange={(e) => setId(e.target.value)} disabled={lock.locked} autoCapitalize="none" placeholder="Username Supplier" className="w-full h-[52px] pl-11 pr-4 rounded-xl border border-outline focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest disabled:opacity-50" />
        </div>
        <div className="relative">
          <Icon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} disabled={lock.locked} type={show ? 'text' : 'password'} placeholder="Masukkan password" className="w-full h-[52px] pl-11 pr-11 rounded-xl border border-outline focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none bg-surface-container-lowest disabled:opacity-50" />
          <button onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"><Icon name={show ? 'visibility_off' : 'visibility'} /></button>
        </div>

        {/* Ingat Login */}
        <button onClick={() => setRemember((r) => !r)} className="flex items-center gap-2.5 w-full text-left active:scale-[.99]">
          <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${remember ? 'bg-primary text-on-primary' : 'border-2 border-outline text-transparent'}`}><Icon name="check" className="!text-[18px]" /></span>
          <span className="font-label-lg">Ingat Login</span>
          <span className="text-label-md text-on-surface-variant ml-auto">{remember ? 'tetap masuk' : 'sesi sementara'}</span>
        </button>

        {error && !lock.locked && <p className="text-center font-label-md text-error">{error}</p>}
        <button onClick={masuk} disabled={!id.trim() || lock.locked} className="w-full h-[52px] bg-primary-container text-on-primary-container rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-40" style={{ backgroundColor: '#b50303', color: '#fff' }}>
          <Icon name="login" /> Masuk
        </button>
        <p className="text-[12px] text-on-surface-variant text-center">Username & password diatur Owner. Hubungi CORNEY jika butuh akses.</p>
      </div>
    </div>
  )
}
