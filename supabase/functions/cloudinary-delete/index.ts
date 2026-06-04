// CORNEY — Edge Function `cloudinary-delete` (TAHAP 4). Hapus gambar lama di
// Cloudinary saat diganti (anti-sampah storage). API Key+Secret di SERVER (env),
// tak boleh di browser. OWNER-only (validasi JWT + cek role profiles).
// SECRET WAJIB: CLOUDINARY_CLOUD, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const CLOUD = Deno.env.get("CLOUDINARY_CLOUD") || ""
const API_KEY = Deno.env.get("CLOUDINARY_API_KEY") || ""
const API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET") || ""
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
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
  // OWNER-only: validasi JWT pemanggil.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "")
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return json({ error: "tidak login" }, 401)
  const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).single()
  if (prof?.role !== "owner") return json({ error: "hanya owner" }, 403)
  const { publicId } = await req.json().catch(() => ({} as Record<string, unknown>))
  if (!publicId) return json({ error: "publicId wajib" }, 400)
  if (!CLOUD || !API_KEY || !API_SECRET) return json({ error: "Cloudinary API belum di-set (CLOUDINARY_API_KEY/SECRET di Edge secret)" }, 500)
  const auth = "Basic " + btoa(`${API_KEY}:${API_SECRET}`)
  const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/upload?public_ids[]=${encodeURIComponent(String(publicId))}`
  const r = await fetch(url, { method: "DELETE", headers: { Authorization: auth } })
  return json(await r.json(), r.status)
})
