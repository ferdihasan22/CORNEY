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
    desc: m.desc || '',
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

// ── Branches (username login DITULIS; password TIDAK — password asli di Supabase Auth) ──
export async function pushBranch(b) {
  if (!b?.id) return
  enqueue({ kind: 'upsert', table: 'branches', key: `branches:${b.id}`, row: {
    id: b.id,
    name: b.name,
    address: b.address || '',
    wa: b.wa || '',
    maps: b.maps || '',
    coord: b.coord || '', // "lat,lng" cabang terdekat (customer)
    qris_img: b.qrisImg || '', // gambar QRIS GoPay per cabang
    maxim_name: b.maximName || b.name,
    kembalian: Math.max(0, Math.round(Number(b.kembalian) || 0)),
    stop_online: b.stopOnline || '21:30',
    close_booth: b.closeBooth || '22:00',
    username: (b.username || `corney-${b.id}`).trim().toLowerCase(), // username login kasir (persist + realtime)
    maxim_enabled: b.maximEnabled !== false, // opsi Maxim/Ojek di checkout customer (default aktif)
    active: b.active !== false,
  } })
}
// Hapus cabang: buang entitas cabang + KONFIG operasionalnya (status buka, override
// harga/saus per cabang). TIDAK menyentuh data LAPORAN historis (salesdaily/
// stockdaily/orders) → laporan periode berjalan tetap utuh sampai Owner Reset Bulan.
export async function removeBranch(id) {
  if (!id) return
  enqueue({ kind: 'delete', table: 'branches', matchId: id, key: `branches_del:${id}` })
  enqueue({ kind: 'delete', table: 'branch_status', match: { branch_id: id }, key: `branch_status_del:${id}` })
  enqueue({ kind: 'delete', table: 'branch_overrides', match: { branch_id: id }, key: `branch_overrides_del:${id}` })
  enqueue({ kind: 'delete', table: 'branch_sauce_overrides', match: { branch_id: id }, key: `branch_sauce_ov_del:${id}` })
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

// ── Sauces (store: {id,name,price}) ──
export async function pushSauce(s) {
  if (!s?.id) return
  enqueue({ kind: 'upsert', table: 'sauces', key: `sauces:${s.id}`, row: {
    id: s.id,
    name: s.name || '',
    price: Math.max(0, Math.round(Number(s.price) || 0)),
  } })
}
export async function removeSauce(id) {
  if (!id) return
  enqueue({ kind: 'delete', table: 'sauces', matchId: id, key: `sauces_del:${id}` })
}

// ── Override saus per cabang (upsert bila ada price/off; DELETE bila kosong) ──
export async function pushSauceOverride(branchId, sauceId, patch) {
  if (!branchId || !sauceId) return
  if (patch && (patch.price != null || patch.off)) {
    enqueue({ kind: 'upsert', table: 'branch_sauce_overrides', onConflict: 'branch_id,sauce_id',
      key: `bso:${branchId}:${sauceId}`,
      row: { branch_id: branchId, sauce_id: sauceId, price: patch.price ?? null, off: !!patch.off } })
  } else {
    enqueue({ kind: 'delete', table: 'branch_sauce_overrides', match: { branch_id: branchId, sauce_id: sauceId },
      key: `bso_del:${branchId}:${sauceId}` })
  }
}

// ── Gambar card landing (full-sync: sort = urutan array) ──
export async function pushLandingCards(cards) {
  if (!Array.isArray(cards) || !cards.length) return
  const rows = cards.map((c, i) => ({
    id: c.id,
    active: c.active !== false,
    sort: i,
    data: { title: c.title || '', img: c.img || '' },
  }))
  enqueue({ kind: 'upsert', table: 'landing_cards', key: 'landing_cards:all', row: rows })
}
export async function removeLandingCard(id) {
  if (!id) return
  enqueue({ kind: 'delete', table: 'landing_cards', matchId: id, key: `landing_cards_del:${id}` })
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
