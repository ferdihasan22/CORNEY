import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MENUS } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import InstallPrompt from '../components/InstallPrompt.jsx'

// 1C.1 — CORNEY App Customer · Landing (PRD §4). Linktree-style: one hero +
// cara pesan. "Order Sekarang" → pilih cabang → katalog. Tombol "Instal Aplikasi"
// memicu prompt PWA (beforeinstallprompt); fallback ke petunjuk manual.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

const HERO = MENUS.find((m) => m.id === 'mozza_ori')?.img

export default function CustomerLanding() {
  const navigate = useNavigate()
  const master = useMaster()

  // Hero = tumpukan kartu "Gambar Landing" (Owner › Gambar Landing) — TERPISAH dari
  // banner katalog. Fallback: banner aktif → foto menu. Swipe otomatis + manual.
  const landing = (master?.landingCards || []).filter((c) => c.active && c.img)
  const banners = (master?.banners || []).filter((b) => b.active && b.img)
  const cards = landing.length ? landing : (banners.length ? banners : (HERO ? [{ id: 'hero', title: '', img: HERO }] : []))
  const n = cards.length
  const [idx, setIdx] = useState(0)
  const touchX = useRef(null)
  useEffect(() => { if (n <= 1) return; const t = setInterval(() => setIdx((i) => (i + 1) % n), 4000); return () => clearInterval(t) }, [n])
  useEffect(() => { if (idx >= n) setIdx(0) }, [n, idx])
  const go = (d) => setIdx((i) => (i + d + n) % n)
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (dx < -40) go(1); else if (dx > 40) go(-1); touchX.current = null }

  return (
    <div className="bg-surface-container-lowest text-on-surface min-h-screen flex flex-col">
      <main className="flex-grow flex flex-col relative w-full max-w-[480px] mx-auto overflow-x-hidden shadow-2xl">
        {/* Hero */}
        <section className="relative bg-primary-container min-h-[55vh] flex flex-col items-center justify-center pt-10 pb-16 px-4 overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-primary rounded-full mix-blend-multiply blur-3xl opacity-70 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary rounded-full mix-blend-multiply blur-3xl opacity-70 translate-x-1/3 translate-y-1/4 pointer-events-none" />

          <div className="relative z-20 mb-6 text-center">
            <h1 className="font-display-lg text-display-lg text-on-primary tracking-tighter uppercase relative inline-block">
              CORNEY
              <span className="absolute -bottom-2 left-0 w-full h-[6px] bg-secondary-container rounded-full -skew-x-12" />
            </h1>
          </div>

          <div className="relative z-20 w-full max-w-[300px] aspect-[4/5] mx-auto mb-6 select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {cards.slice(0, Math.min(3, n)).map((_, k) => {
              const card = cards[(idx + k) % n]
              const front = k === 0
              return (
                <div key={card.id + '-' + k} className="absolute inset-0 rounded-[24px] overflow-hidden shadow-2xl transition-all duration-500 ease-out bg-surface-container" style={{ zIndex: 30 - k, transform: `translate(${k * 12}px, ${k * 10}px) scale(${1 - k * 0.05}) rotate(${front ? -2 : 0}deg)`, opacity: 1 - k * 0.18 }}>
                  <img src={card.img} alt={card.title || 'CORNEY'} className="w-full h-full object-cover" draggable="false" />
                  {front && card.title && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3"><p className="text-white font-bold text-sm leading-tight drop-shadow">{card.title}</p></div>}
                </div>
              )
            })}
          </div>

          {n > 1 && (
            <div className="relative z-20 flex justify-center gap-1.5 mb-5">
              {cards.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} aria-label={`banner ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-on-primary' : 'w-1.5 bg-on-primary/40'}`} />
              ))}
            </div>
          )}

          <p className="relative z-20 font-headline-md text-headline-md text-on-primary text-center opacity-90 drop-shadow-md">#CeritanyaBersamaCorney</p>

          {/* Drip transition */}
          <div className="absolute -bottom-px left-0 w-full overflow-hidden leading-[0] rotate-180 z-30">
            <svg preserveAspectRatio="none" viewBox="0 0 1200 120" xmlns="http://www.w3.org/2000/svg" className="relative block w-[calc(100%+1.3px)] h-12">
              <path fill="#ffffff" d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5" />
              <path fill="#ffffff" d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" />
            </svg>
          </div>
        </section>

        {/* Action section */}
        <section className="bg-surface-container-lowest pt-10 pb-8 px-6 flex-grow flex flex-col">
          <h2 className="font-headline-lg text-headline-lg text-on-surface text-center mb-8">Mau pesan lewat mana?</h2>

          <div className="flex flex-col gap-4 w-full max-w-sm mx-auto">
            <button onClick={() => navigate('/app/cabang')} className="relative overflow-hidden w-full bg-primary text-on-primary rounded-[16px] p-4 flex flex-col items-center justify-center gap-1 shadow-lg shadow-primary/30 active:scale-[0.98] transition-all min-h-[72px]">
              <span className="absolute top-1.5 right-1.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full">Klik ini</span>
              <span className="flex items-center gap-2"><span className="text-[20px] font-extrabold uppercase tracking-wide">Order Sekarang</span><Icon name="arrow_forward" className="text-[24px]" /></span>
              <span className="text-xs text-on-primary/90 text-center leading-snug">Bisa pesan sekarang, ambil nanti · hemat &amp; cepat pakai MAXIM</span>
            </button>

            {/* Instal aplikasi (menonjol) — tombol SADAR-PLATFORM: install langsung
                (Android/Desktop Chrome), tutorial iOS (Safari/Chrome), atau "Buka di
                Browser" untuk webview in-app (Instagram dll). Sembunyi bila terinstal. */}
            <InstallPrompt
              label="Instal Aplikasi Ini"
              sublabel="Ukuran kecil, cuma 3 MB — biar pesan lebih mudah"
              className="relative overflow-hidden w-full bg-secondary-container text-on-secondary-container rounded-[16px] p-4 flex items-center justify-center gap-3 shadow-sm active:scale-[0.98] transition-all min-h-[64px]"
            />

            <a href="https://gofood.co.id" target="_blank" rel="noreferrer" className="w-full bg-surface-container-lowest border-2 border-primary text-primary rounded-[16px] p-4 flex items-center justify-center gap-2 active:bg-primary-container/10 transition-colors min-h-[52px]">
              <span className="font-label-lg text-label-lg">Pesan di GoFood</span><Icon name="open_in_new" className="text-[18px]" />
            </a>
            <a href="https://food.grab.com" target="_blank" rel="noreferrer" className="w-full bg-surface-container-lowest border-2 border-primary text-primary rounded-[16px] p-4 flex items-center justify-center gap-2 active:bg-primary-container/10 transition-colors min-h-[52px]">
              <span className="font-label-lg text-label-lg">Pesan di GrabFood</span><Icon name="open_in_new" className="text-[18px]" />
            </a>

            <button onClick={() => navigate('/app/riwayat')} className="w-full mt-1 text-on-surface-variant rounded-[16px] py-3 flex items-center justify-center gap-2 active:scale-[0.98] transition-all min-h-[52px]">
              <Icon name="receipt_long" className="text-[20px] text-primary" />
              <span className="font-label-lg text-label-lg">Lacak / Riwayat Pesanan Saya</span>
            </button>
          </div>
        </section>

        <footer className="bg-surface-container-lowest py-6 text-center border-t border-surface-variant w-full">
          <p className="text-xs text-tertiary">CORNEY · Balikpapan</p>
        </footer>
      </main>
    </div>
  )
}
