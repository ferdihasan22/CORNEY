// CORNEY — Edge Function `midtrans-status` (TAHAP 4).
// Cek status transaksi Midtrans by order_id (Server Key TIDAK di browser).
// Dipakai KASIR walk-in QRIS (walk-in bukan order DB → tak ada webhook, jadi poll).
// SECRET WAJIB: MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION (sudah di-set utk charge).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const KEY = Deno.env.get("MIDTRANS_SERVER_KEY") || ""
const PROD = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true"
const BASE = PROD ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com"
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } })

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (!KEY) return json({ error: "MIDTRANS_SERVER_KEY belum di-set (Edge secret)" }, 500)
  let orderId: string | null = null
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({} as Record<string, unknown>))
    orderId = (b.orderId as string) || null
  } else {
    orderId = new URL(req.url).searchParams.get("order_id")
  }
  if (!orderId) return json({ error: "orderId wajib" }, 400)
  const auth = "Basic " + btoa(KEY + ":")
  const r = await fetch(BASE + "/v2/" + encodeURIComponent(orderId) + "/status", {
    headers: { Accept: "application/json", Authorization: auth },
  })
  return json(await r.json(), r.status)
})
