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
  const origin = url.origin

  const manifest = {
    name: 'CORNEY',
    short_name: 'CORNEY',
    lang: 'id',
    description: 'Ekosistem aplikasi CORNEY — #CeritanyaBersamaCorney',
    theme_color: '#b50303',
    background_color: '#fcf9f8',
    display: 'standalone',
    scope: origin + '/',
    start_url: origin + u,
    icons: [
      { src: origin + '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: origin + '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: origin + '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: origin + '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
