// CORNEY — Sesi login Kasir (per cabang). "Ingat Login" = localStorage (tetap
// masuk walau browser ditutup); tidak diingat = sessionStorage (hilang saat tutup).
import { signOutSupabase } from '../../auth/supabaseAuth.js'

const KEY = 'corney_kasir_branch'
export function getKasirBranch() { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) }
export function setKasirBranch(id, remember) {
  if (remember) { localStorage.setItem(KEY, id); sessionStorage.removeItem(KEY) }
  else { sessionStorage.setItem(KEY, id); localStorage.removeItem(KEY) }
}
export function clearKasirBranch() { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); signOutSupabase() }
