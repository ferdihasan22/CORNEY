// Cloudflare Turnstile (anti-bot) — OPSIONAL & env-gated. Kalau VITE_TURNSTILE_SITE_KEY
// TAK di-set → fitur MATI total (checkout/charge jalan seperti biasa, tanpa captcha).
// Kalau di-set → widget muncul di checkout/QRIS, token diverifikasi di Edge midtrans-charge.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
export const turnstileEnabled = () => !!TURNSTILE_SITE_KEY

// Penampung token sekali-pakai antara layar Checkout → QRIS (charge).
let pending = null
export function setTurnstileToken(t) { pending = t || null }
export function takeTurnstileToken() { const t = pending; pending = null; return t }
