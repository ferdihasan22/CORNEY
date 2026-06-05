import InstallPrompt from '../components/InstallPrompt.jsx'

// Halaman INSTAL MINIMAL (/install). Dibuka saat tombol "Buka di Browser" di
// webview in-app (Instagram dll) memindahkan user ke browser default — di sini
// mereka langsung lihat tombol Instal, bukan landing penuh.
// Bila sudah terinstal, InstallPrompt menyembunyikan tombol → tampilkan pesan.
export default function CustomerInstall() {
  return (
    <div className="min-h-screen bg-primary-container text-on-primary-container flex flex-col items-center justify-center p-6 text-center">
      <img src="/favicon.svg" alt="CORNEY" className="w-24 h-24 rounded-2xl shadow-lg mb-5" />
      <h1 className="font-display-md text-display-md tracking-tighter uppercase">CORNEY</h1>
      <p className="font-label-md text-label-md opacity-80 mb-8">#CeritanyaBersamaCorney</p>

      <div className="w-full max-w-[360px] bg-surface text-on-surface rounded-2xl shadow-xl p-5 flex flex-col gap-3">
        <p className="font-bold text-headline-md">Pasang Aplikasi CORNEY</p>
        <p className="text-[13px] text-on-surface-variant -mt-1">Akses cepat dari layar utama, tanpa buka browser.</p>
        <InstallPrompt
          label="Instal Sekarang"
          className="w-full h-14 rounded-xl bg-primary text-on-primary font-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md"
        />
        <a href="/app" className="text-[13px] text-primary font-bold mt-1">Lewati, buka aplikasi web →</a>
      </div>
    </div>
  )
}
