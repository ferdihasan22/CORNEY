import { useEffect, useRef } from 'react'
import { TURNSTILE_SITE_KEY, turnstileEnabled } from '../lib/turnstile.js'

// Widget Cloudflare Turnstile. Render null bila fitur mati (VITE_TURNSTILE_SITE_KEY
// kosong) → tak menyentuh alur. Memuat skrip CF sekali, lapor token via onToken().
let scriptP = null
function loadScript() {
  if (typeof window === 'undefined') return Promise.reject()
  if (window.turnstile) return Promise.resolve()
  if (scriptP) return scriptP
  scriptP = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true; s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('turnstile gagal dimuat'))
    document.head.appendChild(s)
  })
  return scriptP
}

export default function TurnstileWidget({ onToken }) {
  const ref = useRef(null)
  const idRef = useRef(null)
  useEffect(() => {
    if (!turnstileEnabled()) return
    let cancelled = false
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return
      idRef.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => onToken && onToken(token),
        'expired-callback': () => onToken && onToken(null),
        'error-callback': () => onToken && onToken(null),
      })
    }).catch(() => {})
    return () => { cancelled = true; try { if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current) } catch { /* abaikan */ } }
  }, [onToken])

  if (!turnstileEnabled()) return null
  return <div ref={ref} className="flex justify-center my-2" />
}
