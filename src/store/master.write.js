// Adapter TULIS master-data ke Supabase (TAHAP 4).
//
// Dipakai master.js HANYA saat VITE_BACKEND=supabase, lewat dynamic import (biar
// bundle mode 'local' tak memuat klien Supabase). Owner sudah login → RLS
// owner_write mengizinkan tulis. SEMUA tulisan lewat OUTBOX (durable offline +
// retry otomatis + anti-clobber) — lihat outbox.js. localStorage tetap commit
// lebih dulu sebagai cache (UI responsif).
//
// Pemetaan bentuk store → kolom tabel kebalikan dari master.remote.js.

import { enqueue } from './outbox.js'

// ── Menus (store: {id,name,parent,category,price,label,img,active}) ──
// `sort` tak dikirim: update mempertahankan urutan lama; baris baru default 0.
export async function pushMenu(m) {
  if (!m?.id) return
  enqueue({ kind: 'upsert', table: 'menus', key: `menus:${m.id}`, row: {
    id: m.id,
    parent_id: m.parent ?? null,
    name: m.name,
    category: m.category === 'sweet' ? 'sweet' : 'savory',
    price: Math.max(0, Math.round(Number(m.price) || 0)),
    label: m.label || '',
    img: m.img || '',
    active: m.active !== false,
  } })
}

// ── Parents / isian induk (store: {id,name,active,threshold}) ──
export async function pushParent(p) {
  if (!p?.id) return
  enqueue({ kind: 'upsert', table: 'parents', key: `parents:${p.id}`, row: {
    id: p.id, name: p.name, active: p.active !== false, threshold: Math.max(0, Number(p.threshold) || 0),
  } })
}

// ── Branches (kolom auth username/password TIDAK ditulis ke tabel ini) ──
export async function pushBranch(b) {
  if (!b?.id) return
  enqueue({ kind: 'upsert', table: 'branches', key: `branches:${b.id}`, row: {
    id: b.id,
    name: b.name,
    address: b.address || '',
    wa: b.wa || '',
    maps: b.maps || '',
    coord: b.coord || '', // "lat,lng" cabang terdekat (customer)
    maxim_name: b.maximName || b.name,
    kembalian: Math.max(0, Math.round(Number(b.kembalian) || 0)),
    stop_online: b.stopOnline || '21:30',
    close_booth: b.closeBooth || '22:00',
    active: b.active !== false,
  } })
}

// ── Promos (field flat → data jsonb; id+active = kolom) ──
export async function pushPromo(p) {
  if (!p?.id) return
  const { id, active, ...data } = p
  enqueue({ kind: 'upsert', table: 'promos', key: `promos:${id}`, row: { id, active: active !== false, data } })
}

// ── Banners (full-sync: sort = urutan array; jumlah sedikit) ──
export async function pushBanners(banners) {
  if (!Array.isArray(banners) || !banners.length) return
  const rows = banners.map((b, i) => ({
    id: b.id,
    active: b.active !== false,
    sort: i,
    data: { title: b.title || '', img: b.img || '' },
  }))
  enqueue({ kind: 'upsert', table: 'banners', key: 'banners:all', row: rows })
}
export async function removeBanner(id) {
  if (!id) return
  enqueue({ kind: 'delete', table: 'banners', matchId: id, key: `banners_del:${id}` })
}

// ── Branch overrides (upsert bila ada patch; DELETE bila override dilepas) ──
export async function pushOverride(branchId, menuId, patch) {
  if (!branchId || !menuId) return
  if (patch && (patch.price != null || patch.off)) {
    enqueue({ kind: 'upsert', table: 'branch_overrides', onConflict: 'branch_id,menu_id', key: `branch_overrides:${branchId}:${menuId}`, row: { branch_id: branchId, menu_id: menuId, patch } })
  } else {
    enqueue({ kind: 'delete', table: 'branch_overrides', match: { branch_id: branchId, menu_id: menuId }, key: `branch_overrides_del:${branchId}:${menuId}` })
  }
}
