// CORNEY — Edge Function `midtrans-charge` (TAHAP 4, FASE 7).
// Buat transaksi QRIS server-side (Server Key TIDAK boleh di browser).
// Proteksi anti-abuse (semua OPSIONAL & fail-safe — tak pernah memblokir bayar asli):
//   1) Rate-limit per-IP (FAIL-OPEN).
//   2) Cloudflare Turnstile (anti-bot) — aktif HANYA bila TURNSTILE_SECRET di-set;
//      siteverify down → fail-open; token kosong saat aktif → tolak (sinyal bot).
//
// SECRET WAJIB: MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION.
// OPSIONAL: TURNSTILE_SECRET. (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis.)
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const KEY = Deno.env.get("MIDTRANS_SERVER_KEY") || ""
const PROD = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true"
const BASE = PROD ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com"
const SB_URL = Deno.env.get("SUPABASE_URL") || ""
const SB_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const TS_SECRET = Deno.env.get("TURNSTILE_SECRET") || ""
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } })

// Rate-limit per IP. FAIL-OPEN: hanya `false` yang memblokir; error/null/no-env → izinkan.
async function rateOk(ip: string): Promise<boolean> {
  if (!SB_URL || !SB_SRV) return true
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/rl_hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_SRV, Authorization: `Bearer ${SB_SRV}` },
      body: JSON.stringify({ p_key: "charge:" + ip, p_max: 15, p_window: 60 }),
    })
    if (!r.ok) return true
    return (await r.json()) !== false
  } catch {
    return true
  }
}

// Verifikasi Turnstile. Mati bila TS_SECRET kosong. Aktif: token wajib & valid;
// siteverify down/error → FAIL-OPEN (jangan blokir customer asli saat CF bermasalah).
async function turnstileOk(token: string | undefined, ip: string): Promise<boolean> {
  if (!TS_SECRET) return true
  if (!token) return false
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: TS_SECRET, response: String(token), remoteip: ip }),
    })
    if (!r.ok) return true
    const d = await r.json()
    return d?.success === true
  } catch {
    return true
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "POST only" }, 405)
  if (!KEY) return json({ error: "MIDTRANS_SERVER_KEY belum di-set (Edge secret)" }, 500)

  const ip = req.headers.get("cf-connecting-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "unknown"
  if (!(await rateOk(ip))) return json({ error: "Terlalu banyak permintaan. Coba lagi sebentar ya." }, 429)

  const { orderId, gross, cf } = await req.json().catch(() => ({}))
  if (!orderId) return json({ error: "orderId wajib" }, 400)
  if (!(await turnstileOk(cf, ip))) return json({ error: "Verifikasi keamanan gagal. Muat ulang halaman & coba lagi." }, 403)

  const auth = "Basic " + btoa(KEY + ":")
  const r = await fetch(BASE + "/v2/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: auth },
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: { order_id: String(orderId), gross_amount: Math.round(Number(gross) || 0) },
      qris: { acquirer: "gopay" },
      custom_expiry: { unit: "minute", expiry_duration: 15 },
    }),
  })
  return json(await r.json(), r.status)
})
