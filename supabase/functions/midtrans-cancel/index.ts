// CORNEY — Edge Function `midtrans-cancel` (TAHAP 4).
// Batalkan transaksi QRIS yang masih pending (Server Key TIDAK boleh di browser).
// Dipakai saat customer "Buat QR Baru" → QR lama tak bisa dibayar lagi (cegah dobel
// bayar). Best-effort: kalau sudah settle/expire, Midtrans menolak → kita abaikan.
//
// SECRET WAJIB: MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const KEY = Deno.env.get("MIDTRANS_SERVER_KEY") || ""
const PROD = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true"
const BASE = PROD ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com"
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } })

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "POST only" }, 405)
  if (!KEY) return json({ error: "MIDTRANS_SERVER_KEY belum di-set (Edge secret)" }, 500)
  const { orderId } = await req.json().catch(() => ({}))
  if (!orderId) return json({ error: "orderId wajib" }, 400)
  const auth = "Basic " + btoa(KEY + ":")
  const r = await fetch(`${BASE}/v2/${encodeURIComponent(String(orderId))}/cancel`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: auth },
  })
  // Best-effort: terus balikan apa pun dari Midtrans (200 = dibatalkan; 412 = tak bisa
  // dibatalkan karena sudah settle/expire — itu wajar & tak masalah).
  return json(await r.json().catch(() => ({})), 200)
})
