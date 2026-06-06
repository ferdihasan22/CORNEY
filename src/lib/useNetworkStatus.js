import { useState, useEffect, useRef, useCallback } from 'react'

// Status jaringan REALTIME untuk gerbang login kasir (APK).
// Gabungan 3 sinyal supaya akurat (navigator.onLine saja bisa BOHONG):
//   1) event online/offline + navigator.onLine
//   2) navigator.connection.effectiveType / rtt (Android WebView mendukung)
//   3) PROBE aktif: fetch ringan ke server Supabase + ukur latensi (deteksi
//      "online tapi tak ada internet beneran" & "lemah").
// status: 'good' | 'weak' | 'offline' | 'checking'
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cajjvmnenxypcolriesf.supabase.co'
const PROBE_URL = SUPA_URL + '/auth/v1/health'
const PROBE_TIMEOUT = 5000 // ms — lewat ini dianggap putus
const WEAK_RTT = 2500      // ms — di atas ini dianggap lemah

export function useNetworkStatus({ intervalMs = 6000 } = {}) {
  const [state, setState] = useState({
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'checking',
    rtt: null,
    eff: (typeof navigator !== 'undefined' && navigator.connection?.effectiveType) || '',
  })
  const busy = useRef(false)
  const timer = useRef(null)

  const probe = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const eff = navigator?.connection?.effectiveType || ''
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState({ status: 'offline', rtt: null, eff })
      busy.current = false
      return
    }
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT)
    const t0 = (typeof performance !== 'undefined' ? performance.now() : 0)
    try {
      // no-cors: cukup tahu jaringan SAMPAI ke server (resolve=online, reject=putus).
      // Hindari false-offline gara-gara CORS di WebView APK.
      await fetch(PROBE_URL, { method: 'GET', cache: 'no-store', mode: 'no-cors', signal: ctrl.signal })
      const rtt = Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0)
      const weak = rtt > WEAK_RTT || eff === 'slow-2g' || eff === '2g'
      setState({ status: weak ? 'weak' : 'good', rtt, eff })
    } catch {
      setState({ status: 'offline', rtt: null, eff }) // timeout / gagal jaringan
    } finally {
      clearTimeout(to)
      busy.current = false
    }
  }, [])

  useEffect(() => {
    probe()
    const onl = () => { setState((s) => ({ ...s, status: 'checking' })); probe() }
    const offl = () => setState((s) => ({ ...s, status: 'offline', rtt: null }))
    window.addEventListener('online', onl)
    window.addEventListener('offline', offl)
    const conn = navigator?.connection
    const onConn = () => probe()
    conn?.addEventListener?.('change', onConn)
    timer.current = setInterval(probe, intervalMs)
    return () => {
      window.removeEventListener('online', onl)
      window.removeEventListener('offline', offl)
      conn?.removeEventListener?.('change', onConn)
      clearInterval(timer.current)
    }
  }, [probe, intervalMs])

  return { ...state, recheck: probe }
}
