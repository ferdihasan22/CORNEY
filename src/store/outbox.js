// CORNEY — Outbox sinkron offline (TAHAP 4 ketahanan kasir).
//
// Masalah: tiap tulisan ke Supabase di .remote.js dulunya "sekali coba" — kalau
// kasir offline saat closing/jualan, dorongan ke DB gagal & TIDAK dicoba ulang,
// dan hydrate berikutnya bisa menimpa data lokal yang belum naik.
//
// Solusi: SEMUA tulisan kritis lewat antrean tahan-mati ini (disimpan di
// localStorage). Kalau online → langsung terkirim & dihapus dari antrean.
// Kalau offline → tersimpan, lalu OTOMATIS dikirim ulang saat internet balik
// (event 'online') atau tiap 20 detik. Hydrate WAJIB flush() dulu + cek
// hasPending() supaya tak menimpa data yang belum tersinkron.
//
// Op shape:
//   { kind:'upsert', table, row, onConflict? , key }
//   { kind:'update', table, matchId, patch,    key }
//   { kind:'rpc',    fn, args,                  key? }
// `key` = penanda logis (mis. 'sales_daily:2026-06-04:gunungsari') agar tulisan
// berulang ke baris yang sama TIDAK menumpuk — yang terbaru menggantikan/menggabung.

import { supabase } from '../lib/supabase.js'
import { debounce } from '../lib/util.js'

const KEY = 'corney_outbox_v1'
const DEAD_KEY = 'corney_outbox_dead_v1' // op gagal permanen (mis. ditolak RLS) → dikarantina, tak memblokir antrean
const MAX_TRIES = 8

const subscribers = new Set()
let queue = load(KEY)
let dead = load(DEAD_KEY)
let flushing = false
let forceOffline = false // hanya untuk UJI (dev): paksa app berperilaku offline tanpa memutus internet sungguhan

// Flush yang digabung: banyak enqueue beruntun (mis. ketik angka config) → 1 kirim.
// Aman: op SUDAH durable di antrean saat enqueue; ini cuma menunda kirim ~400ms.
// Jalur kritis (online event, interval, ClosingReport) tetap panggil flush() langsung.
const debouncedFlush = debounce(() => { flush() }, 400)

function load(k) {
  try { const a = JSON.parse(localStorage.getItem(k)); return Array.isArray(a) ? a : [] } catch { return [] }
}
function saveQueue() { try { localStorage.setItem(KEY, JSON.stringify(queue)) } catch { /* storage penuh */ } }
function saveDead() { try { localStorage.setItem(DEAD_KEY, JSON.stringify(dead.slice(-50))) } catch { /* abaikan */ } }
function notify() { subscribers.forEach((fn) => { try { fn() } catch { /* abaikan */ } }) }

function newId() { return 'op-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) }

// Tambah op ke antrean (dedup by key) lalu coba kirim. Dipanggil dari .remote.js.
export function enqueue(op) {
  const i = op.key ? queue.findIndex((q) => q.key === op.key && q.kind === op.kind) : -1
  if (i >= 0) {
    const ex = queue[i]
    if (op.kind === 'update') ex.patch = { ...ex.patch, ...op.patch } // gabung perubahan (jangan kehilangan kolom)
    else if (op.kind === 'upsert') ex.row = op.row // baris penuh idempoten → yang terbaru menang
    else if (op.kind === 'rpc') ex.args = op.args
    ex.ts = Date.now()
  } else {
    queue.push({ id: newId(), ts: Date.now(), tries: 0, ...op })
  }
  saveQueue()
  notify()
  debouncedFlush() // gabung kirim beruntun (durable sudah aman di atas)
}

async function runOp(op) {
  if (!supabase) throw new Error('supabase belum siap')
  let res
  if (op.kind === 'upsert') res = await supabase.from(op.table).upsert(op.row, op.onConflict ? { onConflict: op.onConflict } : undefined)
  else if (op.kind === 'update') res = await supabase.from(op.table).update(op.patch).eq('id', op.matchId)
  else if (op.kind === 'delete') res = await (op.match ? supabase.from(op.table).delete().match(op.match) : supabase.from(op.table).delete().eq(op.col || 'id', op.matchId))
  else if (op.kind === 'rpc') res = await supabase.rpc(op.fn, op.args)
  else throw new Error('kind tak dikenal: ' + op.kind)
  if (res && res.error) throw res.error
}

// Kirim semua op FIFO. Return true bila antrean kosong (semua terkirim).
// Berhenti di kegagalan pertama (kemungkinan offline) — sisanya dicoba lagi nanti.
export async function flush() {
  if (flushing || !supabase) return queue.length === 0
  if (forceOffline) return false // mode uji: anggap offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  flushing = true
  try {
    // Tulisan staf butuh sesi login (RLS). Bila belum login (mis. baru logout saat
    // ada antrean), TUNDA — jangan dicoba lalu di-quarantine. Akan terkirim saat
    // login lagi (onAuthStateChange memicu flush lewat hydrate).
    const { data: sess } = await supabase.auth.getSession()
    if (!sess?.session) return false
    while (queue.length) {
      const op = queue[0]
      try {
        await runOp(op)
        queue.shift(); saveQueue(); notify()
      } catch (e) {
        // Benar-benar offline → hentikan, simpan semua, coba lagi saat online.
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
        // Online tapi gagal (server down / error sesaat / ditolak) → hitung percobaan.
        op.tries = (op.tries || 0) + 1
        if (op.tries >= MAX_TRIES) {
          // Gagal permanen (mis. ditolak RLS / data invalid) → karantina supaya
          // tidak memblokir tulisan lain selamanya. Tetap tersimpan utk diperiksa.
          dead.push({ ...queue.shift(), error: String((e && e.message) || e) })
          saveDead(); saveQueue(); notify(); continue
        }
        saveQueue()
        return false // error sesaat → berhenti, retry di tick berikutnya
      }
    }
    return true
  } finally { flushing = false }
}

// Apakah masih ada tulisan tabel ini yang belum naik? Dipakai hydrate agar tak menimpa.
// SERTAKAN `dead` (gagal permanen) → cegah hydrate me-REVERT perubahan lokal yang
// belum benar-benar tersimpan, sampai user menyelesaikannya (kirim ulang / buang).
export function hasPending(table) {
  return queue.some((q) => q.table === table) || dead.some((q) => q.table === table)
}
export function pendingCount() { return queue.length }
export function deadCount() { return dead.length }
export function deadItems() { return dead.slice() }
// User klik "kirim ulang": kembalikan semua item karantina ke antrean (reset tries) + flush.
export function retryDead() {
  if (!dead.length) return
  dead.forEach((op) => { op.tries = 0; queue.push(op) })
  dead = []
  saveDead(); saveQueue(); notify(); flush()
}
// User klik "buang": hapus item karantina (perubahan itu memang dilepas).
export function discardDead() { dead = []; saveDead(); notify() }
export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

// UJI (dev only): paksa app seolah offline tanpa memutus internet sungguhan —
// supaya bisa diuji extension/console sambil koneksi tetap nyala. Mati → flush.
export function setForceOffline(v) { forceOffline = !!v; notify(); if (!v) flush() }

// Pemicu otomatis: saat internet balik + jaring pengaman tiap 20 dtk.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flush())
  setInterval(() => { if (queue.length) flush() }, 20000)
}

// Alat UJI khusus DEV (tak ikut ke build produksi/APK). Panggil dari console /
// extension Chrome:
//   corneyOutbox.offline(true)   → app berperilaku offline (tulisan masuk antrean)
//   corneyOutbox.pending()       → jumlah data belum tersinkron
//   corneyOutbox.offline(false)  → online lagi → antrean otomatis terkirim
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.corneyOutbox = { offline: setForceOffline, pending: pendingCount, dead: deadCount, flush }
}
