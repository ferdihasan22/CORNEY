import { useEffect, useRef } from 'react'
import { useOrders } from '../../store/useOrders.js'
import { useDay } from '../../store/useDay.js'
import { getState, PHASE } from '../../store/day.js'
import { getOrders } from '../../store/orders.js'
import { playSfx } from '../../lib/sfx.js'
import { syncCookingNotifs, ensureNotifPermission } from '../../lib/localNotif.js'
import { registerPush } from '../../lib/pushNotif.js'
import { autoPrint, orderToSale } from './autoprint.js'
import { BRANCHES } from '../../data/menu.js'

// Di APK native, alarm "matang" memakai NOTIFIKASI LOKAL (berbunyi di foreground
// & background, tahan app ditutup). Maka SFX in-app 'done' dimatikan khusus
// native agar tak bunyi dua kali. Di web/PWA (tak ada notif lokal) → tetap SFX.
const IS_NATIVE = (() => {
  try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) } catch { return false }
})()

// Watcher SUARA kasir — dipasang GLOBAL (App) supaya berbunyi di layar kasir mana pun
// (home/jualan/online), bukan cuma di Antrean Masak. No-op total bila bukan sesi kasir
// (day null) → app customer/owner tak terpengaruh.
//   • Order online LUNAS baru masuk  → "orderan-masuk" 2x
//   • Gorengan (walk-in/online) matang → "sudah-goreng" 1x
export default function KasirAlerts() {
  const orders = useOrders()
  const day = useDay()
  const knownIds = useRef(null) // baseline id order paid (null = belum di-baseline)
  const alarmedDone = useRef(new Set()) // id masakan yg sudah dialarmkan matang

  // ── Order online masuk → bunyi 2x ──
  useEffect(() => {
    if (!day || day.phase !== PHASE.SELLING) { knownIds.current = null; return }
    const mine = (orders || []).filter(
      (o) => o.branchId === day.branchId && o.paid && (!day.startedAt || new Date(o.createdAt).getTime() >= day.startedAt),
    )
    const ids = new Set(mine.map((o) => o.id))
    if (knownIds.current === null) { knownIds.current = ids; return } // baseline pertama: jangan bunyi
    const fresh = mine.filter((o) => !knownIds.current.has(o.id))
    knownIds.current = ids
    if (fresh.length) {
      playSfx('neworder', 2); playSfx('qris', 1) // dua suara bunyi bersamaan
      const b = BRANCHES.find((x) => x.id === day.branchId) || { name: day.branchId, address: '' }
      fresh.forEach((o) => autoPrint(orderToSale(o), b)) // auto-cetak struk order online (antre bila printer mati)
    }
  }, [orders, day])

  // Saat sesi kasir aktif (native): minta izin notif lokal + daftarkan token push
  // FCM untuk order online. Keduanya no-op di web/PWA & inert bila Firebase belum
  // disiapkan (push) — tak mengganggu apa pun.
  useEffect(() => {
    if (!day) return
    ensureNotifPermission()
    registerPush()
  }, [!!day])

  // ── Gorengan matang → alarm (cek tiap detik; pakai getState/getOrders agar selalu terkini) ──
  useEffect(() => {
    if (!day) return
    const tick = () => {
      const s = getState()
      if (!s || s.phase !== PHASE.SELLING) return
      const now = Date.now()
      const fryers = []
      ;(s.sales || []).forEach((sale) => {
        if (sale.cook?.status === 'frying' && sale.cook.startAt)
          fryers.push({ id: 'w-' + sale.id, end: sale.cook.startAt + (sale.cook.durationMin || 0) * 60000 })
      })
      ;(getOrders() || []).forEach((o) => {
        if (o.branchId === s.branchId && o.cook?.status === 'frying' && o.cook.startAt)
          fryers.push({ id: 'o-' + o.id, end: o.cook.startAt + (o.cook.durationMin || 0) * 60000 })
      })
      const liveIds = new Set(fryers.map((f) => f.id))
      // Native: jadwalkan/batalkan notifikasi lokal sesuai gorengan yang aktif
      // (alarm tetap bunyi walau app di-background/ditutup). No-op di web.
      if (IS_NATIVE) syncCookingNotifs(fryers)
      // Bersihkan penanda untuk yang sudah tak menggoreng (boleh dialarmkan lagi nanti).
      alarmedDone.current.forEach((id) => { if (!liveIds.has(id)) alarmedDone.current.delete(id) })
      fryers.forEach((f) => {
        if (now >= f.end && !alarmedDone.current.has(f.id)) {
          alarmedDone.current.add(f.id)
          // Web/PWA → SFX in-app. Native → notif lokal yang berbunyi (anti-dobel).
          if (!IS_NATIVE) playSfx('done', 1)
        }
      })
    }
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [day])

  return null
}
