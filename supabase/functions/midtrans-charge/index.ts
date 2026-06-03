// CORNEY — Edge Function `midtrans-charge` (TAHAP 4, FASE 7).
// Buat transaksi QRIS server-side (Server Key TIDAK boleh di browser). Pengganti
// produksi dari Vite dev middleware /api/midtrans/charge. Dipanggil customer (anon).
//
// SECRET WAJIB di-set (dashboard/CLI): MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION.
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
  const { orderId, gross } = await req.json().catch(() => ({}))
  if (!orderId) return json({ error: "orderId wajib" }, 400)
  const auth = "Basic " + btoa(KEY + ":")
  const r = await fetch(BASE + "/v2/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: auth },
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: { order_id: String(orderId), gross_amount: Math.round(Number(gross) || 0) },
      qris: { acquirer: "gopay" },
    }),
  })
  return json(await r.json(), r.status)
})
