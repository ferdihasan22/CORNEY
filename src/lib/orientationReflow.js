// Perbaikan bug WebView Android saat rotasi layar.
//
// GEJALA: di tablet (mis. A7 Lite) buka portrait → tombol header muat. Putar ke
// landscape → muat. Putar BALIK ke portrait → tombol header MELUBER lewat tepi
// layar. Penyebabnya: sebagian WebView Android TIDAK meng-evaluasi ulang CSS
// media query (breakpoint `sm:` dll) & lebar viewport setelah rotasi, sehingga
// layout orientasi sebelumnya (landscape yang lebar) "nyangkut" dipakai di
// portrait yang sempit.
//
// PERBAIKAN: saat orientasi berubah, paksa browser melakukan style-recalc penuh
// dengan toggle `display` sekejap pada <body>. Karena hidden→shown terjadi dalam
// satu task JS (tanpa paint di antaranya), tak ada kedipan terlihat, tapi semua
// media query di-cocokkan ulang terhadap lebar viewport yang BARU.
//
// Aman & global: hanya bereaksi pada `orientationchange` (bukan resize biasa,
// supaya tak terpicu saat keyboard muncul). Dibungkus guard — gagal pun app
// tetap jalan normal.

export function installOrientationReflow() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  let timer = null

  const reflow = () => {
    try {
      const b = document.body
      if (!b) return
      const prev = b.style.display
      b.style.display = 'none'
      // baca offsetHeight → paksa reflow/style-recalc terhadap viewport baru
      void b.offsetHeight
      b.style.display = prev || ''
    } catch {
      /* abaikan — app tetap berfungsi tanpa reflow paksa */
    }
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    // beri jeda agar lebar viewport sempat "settle" setelah rotasi selesai
    timer = setTimeout(reflow, 120)
  }

  try {
    window.addEventListener('orientationchange', schedule)
    // Sebagian perangkat tak memicu 'orientationchange' tapi memakai matchMedia
    // orientasi → pasang juga listener ini sebagai cadangan.
    if (window.matchMedia) {
      const mq = window.matchMedia('(orientation: portrait)')
      const onMq = () => schedule()
      if (mq.addEventListener) mq.addEventListener('change', onMq)
      else if (mq.addListener) mq.addListener(onMq) // WebView lawas
    }
  } catch {
    /* abaikan */
  }
}
