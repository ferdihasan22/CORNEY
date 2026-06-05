import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Dev-only Midtrans proxy. QRIS (Core API) MUST be created server-side — the
// Server Key can't be exposed to the browser and Midtrans blocks browser CORS.
// This middleware runs inside the Vite dev server (Node), so the key stays
// server-side. Endpoints: POST /api/midtrans/charge, GET /api/midtrans/status.
// Only active during `npm run dev` (not in build/preview) — the frontend falls
// back to a dummy QR when these endpoints aren't reachable.
function midtransDevApi(env) {
  const SERVER_KEY = env.MIDTRANS_SERVER_KEY || ''
  const isProd = String(env.MIDTRANS_IS_PRODUCTION) === 'true'
  const BASE = isProd ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
  const auth = 'Basic ' + Buffer.from(SERVER_KEY + ':').toString('base64')
  const readJson = (req) =>
    new Promise((resolve) => {
      let d = ''
      req.on('data', (c) => (d += c))
      req.on('end', () => { try { resolve(JSON.parse(d || '{}')) } catch { resolve({}) } })
    })
  return {
    name: 'midtrans-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/midtrans/')) return next()
        res.setHeader('Content-Type', 'application/json')
        const send = (code, obj) => { res.statusCode = code; res.end(JSON.stringify(obj)) }
        if (!SERVER_KEY) return send(500, { error: 'MIDTRANS_SERVER_KEY belum diisi di .env.local' })
        try {
          if (req.method === 'POST' && req.url.startsWith('/api/midtrans/charge')) {
            const { orderId, gross } = await readJson(req)
            const r = await fetch(BASE + '/v2/charge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: auth },
              body: JSON.stringify({
                payment_type: 'qris',
                transaction_details: { order_id: String(orderId), gross_amount: Math.round(Number(gross) || 0) },
                qris: { acquirer: 'gopay' },
              }),
            })
            return send(r.status, await r.json())
          }
          if (req.method === 'GET' && req.url.startsWith('/api/midtrans/status')) {
            const orderId = new URL(req.url, 'http://localhost').searchParams.get('order_id')
            const r = await fetch(BASE + '/v2/' + encodeURIComponent(orderId) + '/status', {
              headers: { Accept: 'application/json', Authorization: auth },
            })
            return send(r.status, await r.json())
          }
          return send(404, { error: 'not found' })
        } catch (e) {
          return send(502, { error: String((e && e.message) || e) })
        }
      })
    },
  }
}

// CORNEY PWA — Vite config (Fase 1). PWA + offline-ready for kasir.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Penanda versi: di Cloudflare Pages pakai SHA commit (CF_PAGES_COMMIT_SHA),
  // lokal → 'lokal'. Ditanam saat build → ditampilkan di layar (cek versi PWA).
  const BUILD_ID = (env.CF_PAGES_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 7) || 'lokal'
  const BUILD_TIME = new Date().toISOString().slice(0, 16).replace('T', ' ')
  return {
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
      __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    },
  plugins: [
    midtransDevApi(env),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'maskable-512.png'],
      manifest: {
        name: 'CORNEY',
        short_name: 'CORNEY',
        description: 'Ekosistem aplikasi CORNEY — #CeritanyaBersamaCorney',
        lang: 'id',
        theme_color: '#b50303',
        background_color: '#fcf9f8',
        display: 'standalone',
        start_url: '/',
        // PNG 192/512 + maskable (full-bleed, safe-zone) → installability kuat &
        // ikon tak ke-crop di Android. SVG tetap untuk browser. iOS pakai
        // apple-touch-icon.png (PNG; iOS abaikan SVG) — lihat index.html.
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3}'],
        // SPA fallback untuk PWA TERINSTAL & offline: navigasi (refresh/buka URL
        // dalam mis. /ops/owner/login) dilayani index.html → React Router yang
        // menangani rutenya. Tanpa ini, refresh di app terinstal balik ke root /
        // gagal dibuka. Denylist: jangan intersep aset & file khusus.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/pwa-manifest/, /\/[^/?]+\.[^/]+$/],
      },
    }),
  ],
  // host: true → server bisa diakses dari HP/tablet lain di WiFi yang sama
  // (lewat IP komputer, mis. http://192.168.x.x:5173). 'localhost' hanya di PC.
  server: { host: true, port: 5173, open: false },
  preview: { host: true, port: 4173 },
  // Target lawas → JS diturunkan ke ES2015 supaya jalan mulus di WebView Android
  // jadul (tablet 2GB). Tanpa plugin tambahan biar bundle tetap ringan.
  build: { target: 'es2015' },
  }
})
