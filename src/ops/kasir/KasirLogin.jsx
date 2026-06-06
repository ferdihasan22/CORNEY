import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_PASSWORD } from '../../data/menu.js'
import { useMaster } from '../../store/useMaster.js'
import { startDay } from '../../store/day.js'
import { setKasirBranch } from './kasirSession.js'
import { lockInfo, recordFail, clearLock } from '../../auth/roleAuth.js'
import { isSupabase, BACKEND } from '../../lib/backend.js'
import { signInKasir } from '../../auth/supabaseAuth.js'
import { BUILD_ID, BUILD_TIME } from '../../lib/build.js'
import { useNetworkStatus } from '../../lib/useNetworkStatus.js'
import InstallPrompt from '../../components/InstallPrompt.jsx'

const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

// Step 1A.1 — Kasir Login (PRD §6.1). UI ported from Stitch "CORNEY POS Login -
// Landscape": centered card, gold underline accent, store/lock icons, password
// reveal. Identity is at BRANCH level (one branch = one account).
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

export default function KasirLogin() {
  const navigate = useNavigate()
  const master = useMaster()
  const branches = master?.branches || []
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const lockKey = `kasir:${username.trim().toLowerCase() || '?'}`
  const [lock, setLock] = useState(() => lockInfo('kasir:?'))
  // Status jaringan realtime — kasir TAK BISA login saat tak ada / lemah.
  const net = useNetworkStatus()
  const netBad = net.status === 'offline' || net.status === 'weak'
  const netReady = net.status === 'good'

  // Hitung mundur saat terkunci.
  useEffect(() => {
    if (!lock.locked) return
    const t = setInterval(() => { const i = lockInfo(lock.key || lockKey); setLock({ ...i, key: lock.key || lockKey }); if (!i.locked) { clearInterval(t); setError('') } }, 1000)
    return () => clearInterval(t)
  }, [lock.locked, lock.key, lockKey])

  async function handleSubmit(e) {
    e.preventDefault()
    const li = lockInfo(lockKey)
    if (li.locked) { setLock({ ...li, key: lockKey }); return }
    if (!netReady) { setError(net.status === 'offline' ? 'Tidak ada internet — sambungkan dulu untuk login.' : 'Jaringan lemah — tunggu sampai stabil dulu ya.'); return }
    const branch = branches.find((b) => b.username === username.trim().toLowerCase())
    if (!branch) {
      const after = recordFail(lockKey); setLock({ ...after, key: lockKey })
      setError(after.locked ? 'Salah 3 kali. Coba lagi nanti.' : 'Username cabang atau password salah.')
      setPassword('')
      return
    }
    if (branch.active === false) {
      setError('Cabang ini sedang dinonaktifkan oleh Owner.')
      return
    }
    // Cek kredensial: mode Supabase → Auth nyata (email kasir.<branch>@corney.app);
    // mode local → password per cabang (atau default global).
    if (isSupabase()) {
      const res = await signInKasir(branch.id, password)
      if (!res.ok) {
        const after = recordFail(lockKey); setLock({ ...after, key: lockKey })
        setError(after.locked ? 'Salah 3 kali. Coba lagi nanti.' : (res.error || 'Username cabang atau password salah.'))
        setPassword('')
        return
      }
    } else {
      const expected = branch.password || DEMO_PASSWORD
      if (password !== expected) {
        const after = recordFail(lockKey); setLock({ ...after, key: lockKey })
        setError(after.locked ? 'Salah 3 kali. Coba lagi nanti.' : 'Username cabang atau password salah.')
        setPassword('')
        return
      }
    }
    clearLock(lockKey)
    setKasirBranch(branch.id, remember)
    startDay(branch.id)
    navigate('/ops/kasir')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-margin-page select-none bg-surface-container-lowest">
      {/* Header */}
      <header className="flex flex-col items-center mb-10">
        <div className="relative mb-2">
          <h1 className="font-display-md text-display-md text-primary-container tracking-tighter">CORNEY</h1>
          <div className="h-1.5 w-1/3 bg-secondary-container absolute -bottom-1 left-0 rounded-full" />
        </div>
        <p className="font-label-md text-label-md text-tertiary-container tracking-wide">#CeritanyaBersamaCorney</p>
      </header>

      {/* Card */}
      <main className="w-full max-w-[420px]">
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl p-8 shadow-[0_4px_16px_rgba(26,26,26,0.08)]">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-6 text-center">Masuk Kasir</h2>
          {lock.locked && (
            <div className="mb-5 bg-error-container/40 border border-error/40 rounded-xl p-3 text-center text-error">
              <p className="font-bold flex items-center justify-center gap-1.5"><Icon name="lock_clock" className="text-[18px]" /> Terkunci sementara</p>
              <p className="font-label-md text-label-md">Terlalu banyak percobaan. Coba lagi dalam <b className="tabular-nums">{mmss(lock.remainingMs)}</b></p>
            </div>
          )}
          {/* Indikator jaringan REALTIME — login dikunci saat offline/lemah */}
          <div className={`mb-5 rounded-xl px-3.5 py-3 flex items-center gap-3 border ${
            net.status === 'good' ? 'bg-green-50 border-green-200 text-green-800'
            : net.status === 'weak' ? 'bg-amber-50 border-amber-200 text-amber-800'
            : net.status === 'offline' ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-surface-container-low border-outline-variant text-on-surface-variant'}`}>
            {net.status === 'checking' ? (
              <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
            ) : net.status === 'offline' ? (
              <Icon name="wifi_off" className="!text-[22px] shrink-0" />
            ) : (
              <span className="flex items-end gap-[2px] h-5 shrink-0" aria-hidden>
                {[1, 2, 3, 4].map((b) => {
                  const lvl = net.status === 'good' ? 4 : 2
                  return <span key={b} className={`w-[3.5px] rounded-sm ${b <= lvl ? 'bg-current' : 'bg-current/25'}`} style={{ height: `${b * 25}%` }} />
                })}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight text-[14px]">
                {net.status === 'good' ? 'Internet lancar' : net.status === 'weak' ? 'Jaringan lemah' : net.status === 'offline' ? 'Tidak ada internet' : 'Memeriksa jaringan…'}
              </p>
              <p className="text-[12px] leading-snug opacity-90">
                {net.status === 'good' ? `Siap login${net.rtt != null ? ` · ${net.rtt} ms` : ''}`
                  : net.status === 'weak' ? 'Tunggu sampai stabil dulu — login dikunci sementara.'
                  : net.status === 'offline' ? 'Sambungkan WiFi/kuota dulu — login dikunci.'
                  : 'Sebentar ya, mengecek koneksi ke server…'}
              </p>
            </div>
            {netBad && (
              <button type="button" onClick={net.recheck} title="Cek ulang" className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 hover:bg-black/5">
                <Icon name="refresh" className="!text-[20px]" />
              </button>
            )}
          </div>

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
                <Icon name="store" className="text-[18px]" /> Username Cabang
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                disabled={netBad}
                className="w-full h-min-tap-target px-4 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none font-body-md text-body-md text-on-surface disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={netBad ? 'Tunggu jaringan stabil…' : 'contoh: corney-sepinggan'}
                type="text"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
                <Icon name="lock" className="text-[18px]" /> Password
              </label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={netBad}
                  className="w-full h-min-tap-target pl-4 pr-12 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none font-body-md text-body-md text-on-surface disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="••••••••"
                  type={show ? 'text' : 'password'}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center h-10 w-10 rounded-full hover:bg-surface-container-high"
                >
                  <Icon name={show ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-5 h-5 accent-primary" />
              <span className="font-label-md text-label-md text-on-surface-variant">Ingat login di perangkat ini</span>
            </label>

            {error && !lock.locked && <p className="text-center font-label-md text-label-md text-error">{error}</p>}

            <button
              type="submit"
              disabled={lock.locked || !netReady}
              className="w-full h-min-tap-target bg-primary-container text-on-primary font-headline-md text-headline-md rounded-xl shadow-[0_8px_24px_rgba(181,3,3,0.2)] active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-40 disabled:active:scale-100"
            >
              {net.status === 'offline' ? (<><Icon name="wifi_off" className="!text-[20px]" /> Tidak ada internet</>)
                : net.status === 'weak' ? (<><Icon name="signal_wifi_bad" className="!text-[20px]" /> Jaringan lemah</>)
                : net.status === 'checking' ? 'Memeriksa jaringan…'
                : 'Masuk'}
            </button>

            <p className="text-center font-label-md text-label-md text-tertiary-container mt-2">
              Hubungi Owner jika lupa password
            </p>
          </form>
          <div className="mt-5"><InstallPrompt label="Instal Aplikasi" /></div>
        </div>
      </main>

      <footer className="mt-16 flex flex-col items-center gap-2 opacity-60">
        <p className="font-label-md text-label-md text-tertiary-container">CORNEY Ops · Kasir</p>
        <div className="flex gap-4">
          <span className="text-[12px] font-label-md text-on-surface-variant">System ID: POS-IDX-7721</span>
          <span className="text-[12px] font-label-md text-on-surface-variant">v0.1.0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-on-surface-variant/70 flex items-center gap-1" title={`Build ${BUILD_ID} · ${BUILD_TIME}`}>
            <Icon name="tag" className="!text-[13px]" /> build {BUILD_ID}
          </span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${isSupabase() ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`} title="Mode data: supabase = ke server (benar untuk produksi); lokal = cuma di perangkat ini">
            <Icon name={isSupabase() ? 'cloud_done' : 'cloud_off'} className="!text-[13px]" /> {BACKEND}
          </span>
        </div>
      </footer>
    </div>
  )
}
