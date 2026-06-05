// Notifikasi LOKAL native (Capacitor) — alarm "gorengan matang / angkat".
//
// KENAPA LOKAL (bukan push/FCM): waktu matang tiap gorengan SUDAH diketahui di
// tablet (startAt + durasi). Jadi kita jadwalkan notifikasi tepat ke waktu itu.
// Android (AlarmManager) tetap memunculkannya + bunyi WALAU app di-background
// atau ditutup — tanpa perlu server/Firebase sama sekali.
//
// Aman & gated: hanya jalan di platform native (APK). Di web/PWA: no-op total
// (plugin di-import dinamis, semua dibungkus try/catch). Tak menyentuh alur app.
//
// Anti-dobel-bunyi: di native, alarm "done" memakai notifikasi ini (channel
// bersuara, berbunyi di foreground & background). Maka SFX in-app 'done'
// DIMATIKAN khusus native (lihat KasirAlerts) supaya tak bunyi dua kali. Di web
// (tak ada notifikasi lokal), SFX in-app tetap dipakai.

const CHANNEL_ID = 'cooking-done'
let inited = false
let nativeCache = null
// Peta id-string masakan (mis. 'w-123' / 'o-uuid') → id-int notifikasi terjadwal.
const scheduled = new Map()

function isNative() {
  if (nativeCache !== null) return nativeCache
  try {
    // eslint-disable-next-line no-undef
    nativeCache = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
  } catch {
    nativeCache = false
  }
  return nativeCache
}

// Hash string → int 32-bit positif (deterministik → cancel tetap cocok lintas reschedule).
function strToInt(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h) % 2000000000 || 1
}

async function ensureInit(LN) {
  if (inited) return
  inited = true
  try {
    const perm = await LN.checkPermissions()
    if (perm.display !== 'granted') await LN.requestPermissions()
  } catch { /* abaikan */ }
  try {
    await LN.createChannel({
      id: CHANNEL_ID,
      name: 'Gorengan Matang',
      description: 'Alarm saat gorengan selesai & harus diangkat',
      importance: 5, // MAX → heads-up + suara
      sound: 'sudah_goreng', // res/raw/sudah_goreng.mp3 (tanpa ekstensi di Android)
      vibration: true,
      lights: true,
      visibility: 1,
    })
  } catch { /* abaikan */ }
}

// Selaraskan notifikasi terjadwal dengan daftar gorengan yang SEDANG menggoreng.
// fryers: [{ id: string, end: number(ms epoch) }]
// - yang baru menggoreng & belum lewat waktu → dijadwalkan
// - yang sudah tak ada (diangkat/dibatalkan) → dibatalkan
export async function syncCookingNotifs(fryers) {
  if (!isNative()) return
  let LN
  try {
    ;({ LocalNotifications: LN } = await import('@capacitor/local-notifications'))
  } catch {
    return // plugin tak tersedia → diam
  }
  await ensureInit(LN)

  const now = Date.now()
  const live = new Set((fryers || []).map((f) => f.id))

  // Batalkan yang sudah tak menggoreng.
  for (const [sid, iid] of [...scheduled.entries()]) {
    if (!live.has(sid)) {
      try { await LN.cancel({ notifications: [{ id: iid }] }) } catch { /* abaikan */ }
      scheduled.delete(sid)
    }
  }

  // Jadwalkan yang baru (waktu matang masih di depan).
  for (const f of fryers || []) {
    if (scheduled.has(f.id)) continue
    if (!(f.end > now)) continue // sudah lewat → ditangani alarm in-app saat foreground
    const iid = strToInt(f.id)
    try {
      await LN.schedule({
        notifications: [{
          id: iid,
          title: '🔥 Gorengan matang!',
          body: 'Sudah waktunya diangkat ya.',
          schedule: { at: new Date(f.end), allowWhileIdle: true },
          channelId: CHANNEL_ID,
          sound: 'sudah_goreng', // dipakai perangkat pra-Android 8
          smallIcon: 'ic_launcher_foreground',
        }],
      })
      scheduled.set(f.id, iid)
    } catch { /* abaikan — gagal jadwal tak boleh ganggu app */ }
  }
}

// Minta izin notifikasi lebih awal (mis. saat sesi kasir dimulai) agar alarm
// pertama tak gagal karena izin belum diberikan.
export async function ensureNotifPermission() {
  if (!isNative()) return
  try {
    const { LocalNotifications: LN } = await import('@capacitor/local-notifications')
    await ensureInit(LN)
  } catch { /* abaikan */ }
}
