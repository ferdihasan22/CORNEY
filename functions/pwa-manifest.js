// Cloudflare Pages Function: manifest PWA DINAMIS via URL asli (bukan blob).
//   GET /pwa-manifest?u=/ops/owner/login
// → mengembalikan manifest dengan start_url = path itu, sehingga PWA yang
//   diinstal dari halaman tsb membuka halaman tsb (Chrome Android & iOS Safari
//   menghormati manifest dari URL https asli; blob/relatif sering ditolak).
// Semua URL ABSOLUT (origin sesuai host: corney.id / kantor.corney.id / dll).
export function onRequest(context) {
  const url = new URL(context.request.url)
  let u = url.searchParams.get('u') || '/'
  // Validasi: hanya path internal (cegah open-redirect / origin lain).
  if (typeof u !== 'string' || !u.startsWith('/') || u.startsWith('//')) u = '/'
  // App STAF (ops/supplier): SELALU buka di BERANDA peran, bukan halaman dalam (mis.
  // Go Live) yang kebetulan jadi start_url terakhir. AuthGate arahkan ke login bila
  // belum masuk. Customer (/app) tetap apa adanya. Menyembuhkan install lama otomatis
  // (manifest no-store → selalu di-fetch ulang).
  const staf = u.match(/^\/(ops\/(?:owner|operasional|produksi|auditor|kasir)|supplier)(?:\/|$)/)
  if (staf) u = '/' + staf[1]
  const origin = url.origin

  // Ikon per host: KASIR (dapur.corney.id) pakai ikon "KASIR CORNEY"; selain itu
  // (corney.id customer, kantor, gudang) pakai ikon CORNEY (iconcorneypwa).
  const isKasir = url.hostname.startsWith('dapur.')
  const p = isKasir ? 'kasir-' : ''

  const manifest = {
    name: isKasir ? 'CORNEY Kasir' : 'CORNEY',
    short_name: isKasir ? 'Kasir' : 'CORNEY',
    lang: 'id',
    description: 'Ekosistem aplikasi CORNEY — #CeritanyaBersamaCorney',
    theme_color: '#b50303',
    background_color: '#fcf9f8',
    display: 'standalone',
    scope: origin + '/',
    start_url: origin + u,
    icons: [
      { src: `${origin}/${p}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${origin}/${p}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${origin}/${p}maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
