// CORNEY — Sesi login Supplier. "Ingat Login" = simpan di localStorage (tetap
// masuk walau browser ditutup). Tidak diingat = sessionStorage (hilang saat
// tab/browser ditutup → harus login lagi).
const KEY = 'corney_supplier_session'

export function getSupplierSession() {
  return localStorage.getItem(KEY) || sessionStorage.getItem(KEY)
}
export function setSupplierSession(id, remember) {
  if (remember) { localStorage.setItem(KEY, id); sessionStorage.removeItem(KEY) }
  else { sessionStorage.setItem(KEY, id); localStorage.removeItem(KEY) }
}
export function clearSupplierSession() {
  localStorage.removeItem(KEY); sessionStorage.removeItem(KEY)
}
