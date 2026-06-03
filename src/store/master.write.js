// Adapter TULIS master-data ke Supabase (TAHAP 4, FASE 1 "write-wiring").
//
// Dipakai master.js HANYA saat VITE_BACKEND=supabase, lewat dynamic import (biar
// bundle mode 'local' tak memuat klien Supabase). Owner sudah login → RLS
// owner_write mengizinkan tulis. localStorage tetap commit lebih dulu sebagai
// cache; tulis ke server fire-and-forget + log error (UI responsif). Antrian
// offline/retry menyeluruh menyusul.
//
// Pemetaan bentuk store → kolom tabel kebalikan dari master.remote.js.

import { supabase } from '../lib/supabase.js'

function logErr(what, error) {
  if (error) console.warn(`[master.write] ${what} gagal:`, error.message || error)
}

// ── Menus (store: {id,name,parent,category,price,label,img,active}) ──
// `sort` tak dikirim: update mempertahankan urutan lama; baris baru default 0.
export async function pushMenu(m) {
  if (!supabase || !m?.id) return
  const { error } = await supabase.from('menus').upsert({
    id: m.id,
    parent_id: m.parent ?? null,
    name: m.name,
    category: m.category === 'sweet' ? 'sweet' : 'savory',
    price: Math.max(0, Math.round(Number(m.price) || 0)),
    label: m.label || '',
    img: m.img || '',
    active: m.active !== false,
  })
  logErr('upsert menu ' + m.id, error)
}

// ── Parents / isian induk (store: {id,name,active,threshold}) ──
export async function pushParent(p) {
  if (!supabase || !p?.id) return
  const { error } = await supabase.from('parents').upsert({
    id: p.id,
    name: p.name,
    active: p.active !== false,
    threshold: Math.max(0, Number(p.threshold) || 0),
  })
  logErr('upsert parent ' + p.id, error)
}

// ── Branches (kolom auth username/password TIDAK ditulis ke tabel ini) ──
export async function pushBranch(b) {
  if (!supabase || !b?.id) return
  const { error } = await supabase.from('branches').upsert({
    id: b.id,
    name: b.name,
    address: b.address || '',
    wa: b.wa || '',
    maps: b.maps || '',
    maxim_name: b.maximName || b.name,
    kembalian: Math.max(0, Math.round(Number(b.kembalian) || 0)),
    stop_online: b.stopOnline || '21:30',
    close_booth: b.closeBooth || '22:00',
    active: b.active !== false,
  })
  logErr('upsert branch ' + b.id, error)
}

// ── Promos (field flat → data jsonb; id+active = kolom) ──
export async function pushPromo(p) {
  if (!supabase || !p?.id) return
  const { id, active, ...data } = p
  const { error } = await supabase.from('promos').upsert({ id, active: active !== false, data })
  logErr('upsert promo ' + id, error)
}

// ── Banners (full-sync: sort = urutan array; jumlah sedikit) ──
export async function pushBanners(banners) {
  if (!supabase || !Array.isArray(banners) || !banners.length) return
  const rows = banners.map((b, i) => ({
    id: b.id,
    active: b.active !== false,
    sort: i,
    data: { title: b.title || '', img: b.img || '' },
  }))
  const { error } = await supabase.from('banners').upsert(rows)
  logErr('upsert banners', error)
}
export async function removeBanner(id) {
  if (!supabase || !id) return
  const { error } = await supabase.from('banners').delete().eq('id', id)
  logErr('delete banner ' + id, error)
}

// ── Branch overrides (upsert bila ada patch; DELETE bila override dilepas) ──
export async function pushOverride(branchId, menuId, patch) {
  if (!supabase || !branchId || !menuId) return
  if (patch && (patch.price != null || patch.off)) {
    const { error } = await supabase.from('branch_overrides').upsert({ branch_id: branchId, menu_id: menuId, patch })
    logErr(`upsert override ${branchId}/${menuId}`, error)
  } else {
    const { error } = await supabase.from('branch_overrides').delete().eq('branch_id', branchId).eq('menu_id', menuId)
    logErr(`delete override ${branchId}/${menuId}`, error)
  }
}
