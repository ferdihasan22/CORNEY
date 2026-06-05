// Push Notification native (FCM) — alert "order online masuk" saat kasir DI LUAR
// app (di WA/Gojek) atau app ditutup. Berbeda dari notif lokal "angkat" yang
// waktunya diketahui di tablet, order online datang dari device lain → hanya
// PUSH dari server (Supabase Edge Function → FCM) yang bisa membangunkan tablet.
//
// File ini HANYA mendaftarkan token FCM device ke server (lewat RPC aman
// register_device_token yang mengambil branch/role dari profiles). Pengiriman
// push dilakukan server saat ada order baru.
//
// GATED & AMAN-INERT: hanya jalan bila (1) platform native, (2) backend Supabase,
// (3) ada sesi login. Bila Firebase/google-services.json BELUM dipasang, register()
// akan gagal di runtime → ditangkap diam-diam, app tetap normal. Jadi memasang
// kode ini tidak merusak apa pun sebelum Firebase siap.

import { supabase } from './supabase.js'
import { isSupabase } from './backend.js'

const ORDER_CHANNEL = 'order-online'
let started = false
let nativeCache = null

function isNative() {
  if (nativeCache !== null) return nativeCache
  try {
    // eslint-disable-next-line no-undef
    nativeCache = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
  } catch { nativeCache = false }
  return nativeCache
}

async function saveToken(token, platform) {
  try {
    if (!supabase) return
    // RPC SECURITY DEFINER: server menautkan token ke user + branch/role dari profiles.
    await supabase.rpc('register_device_token', { p_token: token, p_platform: platform || 'android' })
  } catch { /* abaikan — registrasi gagal tak boleh ganggu app */ }
}

// Panggil saat sesi kasir aktif. Idempoten (hanya sekali pasang listener).
export async function registerPush() {
  if (started) return
  if (!isNative() || !isSupabase()) return
  started = true

  let PN
  try {
    ;({ PushNotifications: PN } = await import('@capacitor/push-notifications'))
  } catch { started = false; return }

  try {
    // Channel khusus order online + suara kustom (dipakai saat notifikasi tampil).
    try {
      await PN.createChannel({
        id: ORDER_CHANNEL,
        name: 'Order Online Masuk',
        description: 'Pemberitahuan saat ada pesanan online baru',
        importance: 5,
        sound: 'orderan_masuk', // res/raw/orderan_masuk.mp3
        vibration: true,
        lights: true,
        visibility: 1,
      })
    } catch { /* abaikan */ }

    const perm = await PN.checkPermissions()
    let status = perm.receive
    if (status !== 'granted') status = (await PN.requestPermissions()).receive
    if (status !== 'granted') { started = false; return } // user tolak → berhenti rapi

    // Token FCM siap → simpan ke server.
    PN.addListener('registration', (t) => { if (t?.value) saveToken(t.value, 'android') })
    PN.addListener('registrationError', () => { /* mis. Firebase belum dikonfigurasi */ })

    await PN.register()
  } catch {
    // Paling umum: FirebaseApp belum init (google-services.json belum dipasang).
    // Diam saja — fitur push tinggal aktif begitu Firebase disiapkan.
    started = false
  }
}
