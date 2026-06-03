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

// Upsert satu menu (store: {id,name,parent,category,price,label,img,active}).
// `sort` sengaja tak dikirim: update mempertahankan urutan lama; baris baru
// memakai default 0 (UI menu belum punya fitur urut-ulang).
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
