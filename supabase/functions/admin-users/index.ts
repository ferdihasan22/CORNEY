// CORNEY — Edge Function `admin-users` (TAHAP 4, FASE 2).
//
// Satu-satunya jalur yang boleh memakai SERVICE_ROLE (buat/ubah akun staf di
// Supabase Auth). TIDAK PERNAH dipanggil dari browser dengan service_role —
// browser hanya memanggil endpoint ini; service_role disuntik otomatis ke Edge.
//
// Otorisasi (di dalam fungsi, bukan cuma gateway):
//   - operasi normal  -> pemanggil harus OWNER (JWT di Authorization).
//   - bootstrap awal   -> token bootstrap cocok DAN belum ada owner sama sekali.
//                         Begitu owner pertama dibuat, jalur bootstrap mati total.
//
// Email staf SINTETIS + `email_confirm: true` => akun langsung bisa login tanpa
// verifikasi email (lihat docs/TAHAP4-SUPABASE.md §8).

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
// Token bootstrap satu-kali: tertanam di sumber server (tidak publik). Hanya
// berfungsi saat profiles belum punya owner; sesudah itu inert selamanya.
const BOOTSTRAP_TOKEN = "corney-bootstrap-7f3a9c2e8b1d4056"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// CORS: fungsi ini dipanggil dari browser (layar Owner) → wajib izinkan preflight.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } })

async function callerIsOwner(req: Request): Promise<boolean> {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)
  if (!m) return false
  const { data, error } = await admin.auth.getUser(m[1])
  if (error || !data?.user) return false
  const { data: prof } = await admin
    .from("profiles").select("role").eq("id", data.user.id).maybeSingle()
  return prof?.role === "owner"
}

async function ownerExists(): Promise<boolean> {
  const { count } = await admin
    .from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner")
  return (count ?? 0) > 0
}

async function findUserByEmail(email: string) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase())
    if (u) return u
    if (data.users.length < 200) return null
    page++
  }
}

async function upsertUser(a: Record<string, unknown>) {
  const email = String(a.email || "").toLowerCase().trim()
  const role = String(a.role || "")
  const branch_id = (a.branch_id ?? null) as string | null
  const name = (a.name ?? null) as string | null
  if (!email || !role) throw new Error("email & role wajib")

  let user = await findUserByEmail(email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: (a.password as string) || undefined,
      email_confirm: true,
      user_metadata: { role, branch_id, name },
    })
    if (error) throw error
    user = data.user
  } else if (a.password) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: a.password as string })
    if (error) throw error
  }

  const { error: pe } = await admin.from("profiles").upsert({
    id: user!.id, role, branch_id, name, active: a.active !== false,
  })
  if (pe) throw pe
  return { email, id: user!.id, role, branch_id }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "POST only" }, 405)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* body kosong */ }
  const action = String(body.action || "")

  // Otorisasi
  let authorized = await callerIsOwner(req)
  if (!authorized) {
    authorized = body.bootstrap_token === BOOTSTRAP_TOKEN && !(await ownerExists())
  }
  if (!authorized) return json({ error: "unauthorized" }, 401)

  try {
    switch (action) {
      case "seed_accounts": {
        const accounts = Array.isArray(body.accounts) ? body.accounts : []
        const results = []
        for (const a of accounts) results.push(await upsertUser(a as Record<string, unknown>))
        return json({ ok: true, count: results.length, results })
      }
      case "create_user":
        return json({ ok: true, result: await upsertUser(body) })
      case "reset_password": {
        const u = await findUserByEmail(String(body.email || ""))
        if (!u) return json({ error: "user tidak ditemukan" }, 404)
        const { error } = await admin.auth.admin.updateUserById(u.id, { password: String(body.password || "") })
        if (error) throw error
        return json({ ok: true })
      }
      case "set_active": {
        const u = await findUserByEmail(String(body.email || ""))
        if (!u) return json({ error: "user tidak ditemukan" }, 404)
        const active = !!body.active
        const { error } = await admin.from("profiles").update({ active }).eq("id", u.id)
        if (error) throw error
        await admin.auth.admin.updateUserById(u.id, { ban_duration: active ? "none" : "876000h" })
        return json({ ok: true })
      }
      case "list": {
        const { data, error } = await admin
          .from("profiles").select("id, role, branch_id, name, active").order("role")
        if (error) throw error
        return json({ ok: true, profiles: data })
      }
      default:
        return json({ error: "unknown action: " + action }, 400)
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
