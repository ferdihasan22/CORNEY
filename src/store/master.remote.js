// Adapter Supabase untuk master-data (TAHAP 4, FASE 1 "pindah baca").
//
// Tugasnya SATU: ambil seluruh data konfigurasi dari Supabase lalu petakan ke
// BENTUK state master yang IDENTIK dengan versi localStorage (lihat master.js
// seed()). Dengan begitu komponen & seluruh fungsi master.js tidak perlu diubah.
//
// Dipanggil lewat dynamic import HANYA saat VITE_BACKEND=supabase, supaya bundle
// mode 'local' tidak ikut memuat kode ini.
//
// Catatan pemetaan (store <-> tabel):
//   menus.parent           <- menus.parent_id
//   promos (flat)          <- promos.data (jsonb) + kolom id/active
//   banners {title,img}    <- banners.data (jsonb) + kolom id/active/sort
//   branchOverrides nested <- baris branch_overrides(branch_id,menu_id,patch)
//   branches.username      -> disintesis 'corney-<id>' (login asli pindah ke
//                             Supabase Auth di FASE 2; kolomnya tak ada di tabel)
//   recipes                -> TIDAK dimigrasi di sini; master.js mempertahankan
//                             recipes dari cache lokal saat hidrasi.

import { supabase } from '../lib/supabase.js'
import { flush, hasPending } from './outbox.js'

const MASTER_TABLES = ['menus', 'parents', 'branches', 'promos', 'banners', 'branch_overrides', 'sauces']

export async function fetchMasterFromSupabase() {
  if (!supabase) throw new Error('Supabase client belum dikonfigurasi (env kosong)')

  // Anti-clobber: kirim dulu edit master yang tertunda. Bila masih ada yang belum
  // naik (offline), JANGAN refetch — lempar agar master.js pertahankan cache lokal.
  await flush()
  if (MASTER_TABLES.some(hasPending)) throw new Error('outbox master pending — pertahankan cache lokal')

  const [branches, parents, menus, sauces, promos, banners, overrides] = await Promise.all([
    supabase.from('branches').select('*').order('id'),
    supabase.from('parents').select('*').order('sort'),
    supabase.from('menus').select('*').order('sort'),
    supabase.from('sauces').select('*').order('id'),
    supabase.from('promos').select('*'),
    supabase.from('banners').select('*').order('sort'),
    supabase.from('branch_overrides').select('*'),
  ])

  for (const r of [branches, parents, menus, sauces, promos, banners, overrides]) {
    if (r.error) throw r.error
  }

  return {
    branches: (branches.data || []).map(mapBranch),
    parents: (parents.data || []).map(mapParent),
    menus: (menus.data || []).map(mapMenu),
    sauces: (sauces.data || []).map(mapSauce),
    promos: (promos.data || []).map(mapPromo),
    banners: (banners.data || []).map(mapBanner),
    branchOverrides: groupOverrides(overrides.data || []),
  }
}

function mapSauce(s) {
  return { id: s.id, name: s.name || '', price: s.price ?? 0 }
}

function mapBranch(b) {
  return {
    id: b.id,
    name: b.name,
    address: b.address || '',
    wa: b.wa || '',
    maps: b.maps || '',
    coord: b.coord || '', // "lat,lng" cabang terdekat (customer)
    qrisImg: b.qris_img || '', // gambar QRIS GoPay per cabang
    username: 'corney-' + b.id, // disintesis (lihat catatan di atas)
    maximName: b.maxim_name || b.name,
    kembalian: b.kembalian ?? 200000,
    active: b.active !== false,
    stopOnline: b.stop_online || '21:30',
    closeBooth: b.close_booth || '22:00',
    password: '', // login asli via Supabase Auth (FASE 2)
  }
}

function mapParent(p) {
  return { id: p.id, name: p.name, active: p.active !== false, threshold: p.threshold ?? 5 }
}

function mapMenu(m) {
  return {
    id: m.id,
    name: m.name,
    parent: m.parent_id,
    category: m.category === 'sweet' ? 'sweet' : 'savory',
    price: m.price ?? 0,
    label: m.label || '',
    img: m.img || '',
    active: m.active !== false,
  }
}

function mapPromo(p) {
  // data jsonb berisi semua field flat selain id/active.
  return { id: p.id, active: p.active !== false, ...(p.data || {}) }
}

function mapBanner(b) {
  const d = b.data || {}
  return { id: b.id, active: b.active !== false, title: d.title || '', img: d.img || '' }
}

function groupOverrides(rows) {
  const out = {}
  for (const r of rows) {
    if (!out[r.branch_id]) out[r.branch_id] = {}
    out[r.branch_id][r.menu_id] = r.patch || {}
  }
  return out
}
