// CORNEY — Edge Function `midtrans-webhook` (TAHAP 4, FASE 7).
// Menerima notifikasi pembayaran Midtrans → set orders.paid=true (OTORITATIF,
// menggantikan markPaid sisi klien). Verifikasi signature SHA-512 dgn Server Key.
// verify_jwt=false (dipanggil server Midtrans, bukan user) — auth = signature.
//
// SECRET WAJIB: MIDTRANS_SERVER_KEY. SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY auto.
// Di dashboard Midtrans: set Payment Notification URL ke fungsi ini.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const KEY = Deno.env.get("MIDTRANS_SERVER_KEY") || ""
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 })
  const n = await req.json().catch(() => ({}))
  // Signature Midtrans = sha512(order_id + status_code + gross_amount + ServerKey)
  const raw = `${n.order_id}${n.status_code}${n.gross_amount}${KEY}`
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(raw))
  const sig = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
  if (!KEY || sig !== n.signature_key) {
    // Audit: log percobaan signature gagal (kemungkinan fraud) — terlihat di Edge logs.
    console.warn("[midtrans-webhook] signature TIDAK cocok — tolak (kemungkinan fraud). order_id=", n.order_id, "status=", n.transaction_status)
    return new Response(JSON.stringify({ error: "bad signature" }), { status: 401 })
  }

  const paid = ["settlement", "capture"].includes(n.transaction_status)
  if (paid && n.order_id) {
    // mid order_id = "<orderUuid>-<base36ts>" → ambil uuid (buang segmen terakhir).
    const s = String(n.order_id)
    const oid = s.lastIndexOf("-") > 0 ? s.substring(0, s.lastIndexOf("-")) : s
    await admin.from("orders").update({ paid: true, pay_method: "qris" }).eq("id", oid)
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } })
})
