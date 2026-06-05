import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../data/menu.js'
import { useDay } from '../store/useDay.js'
import { PHASE } from '../store/day.js'
import { useMaster } from '../store/useMaster.js'
import { useBranchStatus } from '../store/useBranchStatus.js'
import { refreshBranchStatus } from '../store/branchStatus.js'
import { isSupabase } from '../lib/backend.js'

// 1C.2 — CORNEY App Customer · Pilih Cabang (PRD §4.4). Booth photos aren't
// available → branded tile. NEW: izin lokasi (GPS) → urutkan cabang TERDEKAT
// (jarak haversine ke koordinat cabang yang diisi Owner). Popup ajakan muncul
// selama belum diizinkan; sekali diizinkan, tak mengganggu lagi.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

// Jarak (km) antar dua titik lat/lng — haversine.
function haversineKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}
function parseCoord(c) {
  if (!c) return null
  const [la, ln] = String(c).split(',').map((s) => parseFloat(s.trim()))
  return Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : null
}
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)
// Penanda: customer sudah pernah mengizinkan lokasi → jangan tampilkan popup lagi
// saat navigasi back-forward (remount). Lebih andal daripada Permissions API yang
// kadang telat update state di sebagian browser HP.
const GEO_FLAG = 'corney_geo_ok'

export default function CustomerChooseBranch() {
  const navigate = useNavigate()
  const day = useDay()
  useMaster() // re-render saat Owner tambah/edit/nonaktifkan cabang (sumber tunggal)
  const status = useBranchStatus() // status buka cabang dari SERVER (lintas perangkat)

  const [coords, setCoords] = useState(null) // {lat,lng} lokasi customer
  const [showGeo, setShowGeo] = useState(false) // popup ajakan izin lokasi
  const [geoHint, setGeoHint] = useState('') // pesan bila izin diblokir browser

  useEffect(() => {
    // Poll RINGAN status buka cabang (tanpa realtime).
    let t = null
    const start = () => { if (!t) { refreshBranchStatus(); t = setInterval(refreshBranchStatus, 30000) } }
    const stop = () => { clearInterval(t); t = null }
    const onVis = () => (document.hidden ? stop() : start())
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // Minta lokasi. fromButton=true → tampilkan petunjuk bila diblokir.
  const askLocation = (fromButton) => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => { try { localStorage.setItem(GEO_FLAG, '1') } catch { /* abaikan */ } setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setShowGeo(false); setGeoHint('') },
      (err) => {
        if (fromButton && err.code === err.PERMISSION_DENIED) setGeoHint('Izin lokasi sedang diblokir. Aktifkan lewat ikon 🔒/ⓘ di address bar → Izinkan Lokasi.')
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  }

  // Cek izin saat masuk. Logika:
  //  - Kalau pernah granted di sesi ini (flag localStorage) → ambil diam-diam, TANPA popup.
  //  - Kalau Permissions API bilang 'granted' → sama, tanpa popup + simpan flag.
  //  - Kalau 'denied'/'prompt'/API tak ada → tampilkan popup ajakan.
  // Flag disimpan di localStorage (GEO_FLAG) supaya navigasi back-forward
  // (remount) tidak memunculkan popup lagi setelah user sudah mengizinkan.
  useEffect(() => {
    if (!navigator.geolocation) return
    let cancelled = false

    const grantedNow = () => {
      if (cancelled) return
      try { localStorage.setItem(GEO_FLAG, '1') } catch { /* abaikan */ }
      setShowGeo(false)
      askLocation(false)
    }

    // Sudah pernah diizinkan (flag tersimpan) → langsung ambil, tak perlu Permissions API.
    if (localStorage.getItem(GEO_FLAG)) { grantedNow(); return () => { cancelled = true } }

    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then((res) => {
          if (cancelled) return
          if (res.state === 'granted') { grantedNow(); return }
          setShowGeo(true)
          // Dengarkan perubahan izin (user baru saja klik "Izinkan" di prompt browser).
          const onChange = () => { if (res.state === 'granted') grantedNow() }
          res.addEventListener('change', onChange)
        })
        .catch(() => { if (!cancelled) setShowGeo(true) })
    } else {
      setShowGeo(true) // Permissions API tak tersedia → tampilkan ajakan
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const isOpen = (id) => {
    if (isSupabase()) {
      const st = status[id]
      const stop = BRANCHES.find((b) => b.id === id)?.stopOnline || '21:30'
      return !!st?.open && st.openDate === todayISO && nowHHMM <= stop
    }
    return !!day && day.branchId === id && day.phase === PHASE.SELLING
  }

  // Daftar cabang + jarak; urutkan TERDEKAT bila lokasi sudah ada.
  const list = BRANCHES.filter((b) => b.active !== false).map((b) => {
    const bc = parseCoord(b.coord)
    const dist = coords && bc ? haversineKm(coords, bc) : null
    return { b, dist }
  })
  if (coords) list.sort((x, y) => (x.dist ?? Infinity) - (y.dist ?? Infinity))
  const nearest = coords && list[0]?.dist != null ? list[0] : null

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-surface shadow-sm flex items-center justify-between px-4 h-[64px] shrink-0">
        <button onClick={() => navigate('/app')} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="arrow_back" /></button>
        <div className="absolute left-1/2 -translate-x-1/2 text-headline-lg font-headline-lg font-black text-primary uppercase tracking-tighter">CORNEY</div>
        <span className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-28 max-w-[480px] mx-auto w-full">
        <section className="text-center mb-5">
          <h1 className="font-headline-md text-headline-md text-on-surface mb-1">Pilih Cabang Terdekat</h1>
          <p className="font-body-md text-on-surface-variant">Menu &amp; harga bisa beda tiap cabang</p>
        </section>

        {nearest ? (
          <div className="flex justify-center mb-7">
            <div className="inline-flex items-center gap-2 bg-primary-fixed text-primary px-4 py-2 rounded-full border border-primary/20 shadow-sm">
              <Icon name="near_me" fill className="text-primary text-[18px]" />
              <span className="font-label-md text-label-md font-bold">Terdekat: {nearest.b.name.replace('CORNEY ', '')} · {fmtKm(nearest.dist)}</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-7">
            <button onClick={() => askLocation(true)} className="inline-flex items-center gap-2 bg-surface-container-lowest px-4 py-2 rounded-full border border-outline-variant shadow-sm active:scale-95">
              <Icon name="location_on" className="text-primary text-[18px]" />
              <span className="font-label-md text-label-md">Aktifkan lokasi untuk cabang terdekat</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {list.map(({ b, dist }, idx) => {
            const open = isOpen(b.id)
            const isNear = coords && idx === 0 && dist != null
            const openUntil = b.closeBooth || '22:00'
            const onlineUntil = b.stopOnline || '21:30'
            return (
              <button
                key={b.id}
                onClick={() => open && navigate(`/app/katalog/${b.id}`)}
                disabled={!open}
                className={`relative flex items-stretch w-full rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(26,26,26,0.08)] text-left transition-all active:scale-[.98] ${open ? 'bg-white ring-1 ring-outline-variant hover:ring-2 hover:ring-primary' : 'bg-surface-container-high opacity-75 grayscale-[0.5] cursor-not-allowed'} ${isNear ? 'ring-2 ring-primary' : ''}`}
              >
                {isNear && <span className="absolute top-2 left-2 z-20 bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-1"><Icon name="near_me" fill className="!text-[12px]" /> Terdekat</span>}
                <div className="w-1/3 min-h-[140px] relative bg-primary-container flex items-center justify-center overflow-hidden">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-primary rounded-full mix-blend-multiply blur-2xl opacity-60 -translate-x-1/3 -translate-y-1/3" />
                  <Icon name="storefront" fill className="text-on-primary-container !text-5xl relative z-10" />
                </div>
                <div className="w-2/3 p-4 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h3 className="font-headline-md text-[18px] leading-tight">{b.name}</h3>
                      {dist != null && <span className={`font-label-md text-[12px] shrink-0 flex items-center gap-0.5 ${isNear ? 'text-primary font-bold' : 'text-on-surface-variant'}`}><Icon name="near_me" className="!text-[13px]" />{fmtKm(dist)}</span>}
                    </div>
                    <p className="font-body-md text-[14px] text-on-surface-variant mb-2 line-clamp-1">{b.address}</p>
                    {open ? (
                      <span className="bg-green-100 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Buka · tutup {openUntil}</span>
                    ) : (
                      <span className="bg-surface-dim text-on-surface-variant text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Belum buka</span>
                    )}
                  </div>
                  <p className="font-label-md text-[12px] text-on-surface-variant italic">{open ? `online sampai ${onlineUntil}` : 'kasir belum buka toko hari ini'}</p>
                </div>
              </button>
            )
          })}
        </div>
      </main>

      <div className="fixed bottom-0 w-full z-50 max-w-[480px] left-1/2 -translate-x-1/2">
        <div className="bg-secondary-container text-on-secondary-container px-3 py-3 text-center font-label-md text-label-md">
          Cabang terpilih dipakai terus selama kamu belanja.
        </div>
      </div>

      {/* Popup ajakan izin lokasi — ramah, tidak memaksa. Muncul selama belum diizinkan. */}
      {showGeo && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <style>{`@keyframes geoPop{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
          <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-2xl text-center" style={{ animation: 'geoPop .25s ease-out' }}>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary-fixed flex items-center justify-center relative">
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <Icon name="near_me" fill className="text-primary !text-[38px] relative z-10" />
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Cari corndog terdekat? 📍</h2>
            <p className="text-body-md text-on-surface-variant leading-snug mb-1">
              Izinkan lokasi sebentar yuk, biar CORNEY bisa <strong>mengurutkan cabang dari yang paling dekat</strong> denganmu — hemat waktu, corndog cepat sampai! 🌽
            </p>
            <p className="text-[12px] text-on-surface-variant/80 mb-5">Cuma untuk cari cabang terdekat kok, santai aja 😊</p>
            {geoHint && <p className="text-[12px] text-error mb-4 leading-snug flex items-start gap-1 text-left"><Icon name="info" className="!text-[16px] shrink-0" /> {geoHint}</p>}
            <button onClick={() => askLocation(true)} className="w-full h-[52px] bg-primary text-on-primary rounded-2xl font-bold text-body-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <Icon name="my_location" /> Izinkan Lokasi
            </button>
            <button onClick={() => setShowGeo(false)} className="w-full h-11 mt-2 text-on-surface-variant font-label-lg rounded-xl active:bg-surface-container transition-colors">Nanti saja</button>
          </div>
        </div>
      )}
    </div>
  )
}
