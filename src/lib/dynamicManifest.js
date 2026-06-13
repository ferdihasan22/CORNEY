// Arahkan <link rel="manifest"> ke Pages Function /pwa-manifest?u=<halaman ini>,
// supaya PWA yang diinstal dari /ops/owner/login membuka /ops/owner/login (berlaku
// semua halaman). Pakai URL ASLI (https) — Chrome & iOS menghormatinya untuk
// install; manifest blob/relatif sering ditolak. Lihat functions/pwa-manifest.js.
export function applyDynamicManifest() {
  if (typeof document === 'undefined') return
  try {
    const link = document.querySelector('link[rel="manifest"]')
    if (!link) return
    const pathname = window.location.pathname || '/'
    // App STAF (ops/supplier): start_url = BERANDA peran (bukan halaman dalam spt Go
    // Live). Customer (/app, dll.): pakai halaman ini + query (mis. cabang terakhir).
    const staf = pathname.match(/^\/(ops\/(?:owner|operasional|produksi|auditor|kasir)|supplier)(?:\/|$)/)
    const path = staf ? '/' + staf[1] : pathname + (window.location.search || '')
    link.setAttribute('href', '/pwa-manifest?u=' + encodeURIComponent(path))
  } catch {
    /* gagal → biarkan manifest statis (start_url '/') */
  }
}
