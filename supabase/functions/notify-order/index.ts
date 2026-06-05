// CORNEY — Edge Function `notify-order`.
// Kirim PUSH "order online masuk" (FCM HTTP v1) ke tablet kasir cabang terkait,
// supaya berbunyi walau app di-background/ditutup (kasir lagi di WA/Gojek).
//
// Dipicu oleh Database Webhook / trigger pada tabel `orders` (lihat migration
// trigger terpisah). Bukan endpoint publik untuk user — diproteksi header rahasia.
//
// SECRET WAJIB (set di Supabase → Edge Functions secrets):
//   - GOOGLE_SERVICE_ACCOUNT : isi JSON service account Firebase (1 baris).
//   - NOTIFY_HOOK_SECRET     : string acak; harus cocok dgn header x-hook-secret.
//   (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis tersedia.)
//
// Catatan deploy: fungsi ini TIDAK memakai verify_jwt (dipanggil oleh DB, bukan
// user). Deploy dengan --no-verify-jwt.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const SB_URL = Deno.env.get("SUPABASE_URL") || ""
const SB_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const SA_RAW = Deno.env.get("GOOGLE_SERVICE_ACCOUNT") || ""
const HOOK_SECRET = Deno.env.get("NOTIFY_HOOK_SECRET") || ""
const ORDER_CHANNEL = "order-online"

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } })

// ── util base64url ──
function b64url(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array
  if (typeof data === "string") bytes = new TextEncoder().encode(data)
  else if (data instanceof Uint8Array) bytes = data
  else bytes = new Uint8Array(data)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "")
  const bin = atob(body)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

// ── OAuth2: service account JWT → access_token (scope firebase.messaging) ──
let cachedToken: { token: string; exp: number } | null = null
async function getAccessToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }))
  const signingInput = `${header}.${claim}`
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  )
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput))
  const jwt = `${signingInput}.${b64url(sig)}`
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt,
    }),
  })
  const d = await r.json()
  if (!d.access_token) throw new Error("OAuth gagal: " + JSON.stringify(d))
  cachedToken = { token: d.access_token, exp: now + (d.expires_in || 3600) }
  return d.access_token
}

// ── ambil token device kasir untuk satu cabang ──
async function tokensForBranch(branchId: string): Promise<string[]> {
  const url = `${SB_URL}/rest/v1/device_tokens?select=token&role=eq.kasir&branch_id=eq.${encodeURIComponent(branchId)}`
  const r = await fetch(url, { headers: { apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` } })
  if (!r.ok) return []
  const rows = await r.json()
  return Array.isArray(rows) ? rows.map((x: { token: string }) => x.token).filter(Boolean) : []
}

// ── kirim 1 pesan FCM v1 ──
async function sendFcm(projectId: string, accessToken: string, token: string, title: string, body: string) {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        android: {
          priority: "HIGH",
          notification: { channel_id: ORDER_CHANNEL, sound: "orderan_masuk", default_vibrate_timings: true },
        },
      },
    }),
  })
  return { ok: r.ok, status: r.status, body: r.ok ? null : await r.text() }
}

// Apakah event ini "order online baru LUNAS"? Dukung payload Database Webhook
// {type, record, old_record} maupun panggilan manual {branch_id, order_id,...}.
function decide(p: Record<string, unknown>): { notify: boolean; branchId?: string; orderId?: string } {
  const rec = (p.record as Record<string, unknown>) || p
  const old = (p.old_record as Record<string, unknown>) || null
  const branchId = (rec.branch_id ?? rec.branchId) as string | undefined
  const orderId = (rec.id ?? rec.order_id) as string | undefined
  const paid = rec.paid === true
  const baru = (rec.status ?? "baru") === "baru"
  const wasPaid = old ? old.paid === true : false
  // INSERT lunas, atau UPDATE saat paid baru menjadi true.
  const notify = !!branchId && paid && baru && !wasPaid
  return { notify, branchId, orderId }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405)
  // Proteksi: hanya pemanggil dengan secret yang benar (DB trigger).
  if (!HOOK_SECRET || req.headers.get("x-hook-secret") !== HOOK_SECRET)
    return json({ error: "unauthorized" }, 401)
  if (!SA_RAW) return json({ error: "GOOGLE_SERVICE_ACCOUNT belum di-set" }, 500)

  let payload: Record<string, unknown>
  try { payload = await req.json() } catch { return json({ error: "bad json" }, 400) }

  const { notify, branchId } = decide(payload)
  if (!notify || !branchId) return json({ skipped: true })

  let sa: Record<string, string>
  try { sa = JSON.parse(SA_RAW) } catch { return json({ error: "GOOGLE_SERVICE_ACCOUNT bukan JSON valid" }, 500) }

  const tokens = await tokensForBranch(branchId)
  if (tokens.length === 0) return json({ sent: 0, note: "tak ada token kasir untuk cabang ini" })

  const accessToken = await getAccessToken(sa)
  const title = "🛵 Order online masuk!"
  const body = "Ada pesanan online baru, cek sekarang ya."
  const results = await Promise.all(tokens.map((t) => sendFcm(sa.project_id, accessToken, t, title, body)))
  const sent = results.filter((r) => r.ok).length

  // Bersihkan token mati (FCM 404/UNREGISTERED) opsional — dibiarkan sederhana di sini.
  return json({ sent, total: tokens.length })
})
