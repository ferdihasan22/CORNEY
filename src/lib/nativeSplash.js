// Splash screen native (Capacitor / APK Kasir).
//
// Tujuan: di tablet lemah (A7 Lite, RAM 3GB) cold start memakan 2–4 dtk. Tanpa
// splash, layar putih sebentar terlihat seperti "hang". Splash menutupinya
// dengan logo/warna brand. Ini MURNI KOSMETIK — tidak mempercepat app.
//
// JARING PENGAMAN BERLAPIS (supaya splash tak pernah "nyangkut" menutup app):
//   1) Native (capacitor.config.json): launchAutoHide=true + launchShowDuration
//      => sisi Android menyembunyikan splash sendiri setelah durasi itu, BAHKAN
//      jika mesin JS mati total. Ini pengaman utama yang tak bergantung JS.
//   2) JS (file ini): hide() dipanggil saat app sudah render (lebih cepat dari
//      timer di atas) + timeout cadangan. Dibungkus try/catch — gagal pun aman.
//
// Hanya aktif di platform native. Di web/PWA: no-op total (return lebih awal,
// plugin di-import dinamis sehingga tak menambah beban bundle web).

export function hideSplashWhenReady() {
  let done = false
  const run = async () => {
    if (done) return
    done = true
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor?.isNativePlatform?.()) return // web/PWA → tak ada splash
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide()
    } catch {
      // Diam saja: kalau gagal, jaring pengaman native (launchAutoHide) tetap
      // menyembunyikan splash. App tak akan pernah terkunci.
    }
  }

  // Sembunyikan setelah React melukis frame pertama (terasa secepat mungkin).
  try {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(run))
    } else {
      run()
    }
  } catch {
    run()
  }

  // Cadangan JS: jika rAF tak pernah jalan, paksa hide setelah 2.5 dtk.
  // (Pengaman native 3 dtk tetap lapisan terakhir.)
  try {
    setTimeout(run, 2500)
  } catch {
    /* abaikan */
  }
}
