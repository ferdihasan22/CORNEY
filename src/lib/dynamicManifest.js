// Manifest PWA DINAMIS: set `start_url` = halaman saat ini, supaya PWA yang
// diinstal dari /ops/owner/login membuka /ops/owner/login (bukan start_url
// statis '/'). Berlaku untuk SEMUA halaman → instal dari mana pun, buka di situ.
//
// Caranya: salin manifest dasar (nama/ikon/tema dari VitePWA), override start_url
// ke path sekarang, buat Blob URL, lalu pasang ke <link rel="manifest">. Browser
// (Chrome Android, iOS Safari modern) membaca manifest ini saat install.
// scope tetap '/' → PWA tetap bisa navigasi ke seluruh app.

let base = null

export async function applyDynamicManifest() {
  if (typeof document === 'undefined') return
  const link = document.querySelector('link[rel="manifest"]')
  if (!link) return
  try {
    if (!base) {
      // Simpan href asli sekali (sebelum diganti Blob) lalu ambil manifest dasar.
      const orig = link.getAttribute('data-orig-href') || link.getAttribute('href')
      link.setAttribute('data-orig-href', orig)
      base = await (await fetch(orig)).json()
    }
    const path = window.location.pathname + window.location.search
    // id default = start_url; cukup override start_url. scope tetap dari base ('/').
    const dyn = { ...base, start_url: path }
    if (link._blobUrl) { try { URL.revokeObjectURL(link._blobUrl) } catch { /* noop */ } }
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(dyn)], { type: 'application/manifest+json' }))
    link._blobUrl = blobUrl
    link.setAttribute('href', blobUrl)
  } catch {
    /* gagal → biarkan manifest statis (start_url '/') yang dipakai */
  }
}
