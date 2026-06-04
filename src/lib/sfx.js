// CORNEY — efek suara kasir. File di public/sfx (disajikan di root).
// Browser memblokir audio sampai ADA interaksi user → kita "unlock" sekali saat
// sentuhan/klik pertama (kasir pasti menyentuh layar saat buka hari).
const FILES = {
  done: '/sfx/sudah-goreng.mp3', // alarm gorengan selesai
  neworder: '/sfx/orderan-masuk.mp3', // notif order online masuk
}

let unlocked = false
function unlock() {
  if (unlocked) return
  unlocked = true
  Object.values(FILES).forEach((url) => {
    try {
      const a = new Audio(url)
      a.muted = true
      a.play().then(() => { a.pause(); a.currentTime = 0 }).catch(() => {})
    } catch { /* abaikan */ }
  })
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
  window.addEventListener('touchstart', unlock, { once: true })
}

// Putar suara `name` sebanyak `times` kali BERURUTAN (tunggu selesai baru ulang).
export function playSfx(name, times = 1) {
  const url = FILES[name]
  if (!url) return
  let count = 0
  const playOnce = () => {
    try {
      const a = new Audio(url)
      a.addEventListener('ended', () => { count += 1; if (count < times) playOnce() })
      a.play().catch(() => {})
    } catch { /* abaikan */ }
  }
  playOnce()
}
