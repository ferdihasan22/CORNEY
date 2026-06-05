// Arahkan <link rel="manifest"> ke Pages Function /pwa-manifest?u=<halaman ini>,
// supaya PWA yang diinstal dari /ops/owner/login membuka /ops/owner/login (berlaku
// semua halaman). Pakai URL ASLI (https) — Chrome & iOS menghormatinya untuk
// install; manifest blob/relatif sering ditolak. Lihat functions/pwa-manifest.js.
export function applyDynamicManifest() {
  if (typeof document === 'undefined') return
  try {
    const link = document.querySelector('link[rel="manifest"]')
    if (!link) return
    const path = (window.location.pathname || '/') + (window.location.search || '')
    link.setAttribute('href', '/pwa-manifest?u=' + encodeURIComponent(path))
  } catch {
    /* gagal → biarkan manifest statis (start_url '/') */
  }
}
