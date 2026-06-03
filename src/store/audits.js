// CORNEY — Field audit store (OPS-02 Audit Lapangan, Fase 2 dummy/local).
// Operasional cross-checks system (kasir) numbers vs physical, reports to Owner
// (second oversight layer). Each audit bundles per-filling rows.
//
// Audit: { id, branchId, branchName, note, allCocok, createdAt,
//   rows: [{ parent, parentName, sys:{sisa,patah,hilang}, riil:{sisa,patah,hilang}, cocok }] }

const KEY = 'corney_audits'
const subscribers = new Set()
let list = load()

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(s) ? s : []
  } catch {
    return []
  }
}
function commit(next) {
  list = next
  localStorage.setItem(KEY, JSON.stringify(next))
  subscribers.forEach((fn) => fn())
}

// Sinkron antar-tab: reload saat tab lain menulis (cegah clobber + realtime).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { list = load(); subscribers.forEach((fn) => fn()) } })
}

export function getAudits() {
  return list
}
export function subscribeAudits(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

// Ringkasan selisih sebuah audit untuk ditampilkan di PWA Owner.
// lines: semua isian (sys/riil/selisih) · beda: yang selisihnya ≠ 0 ·
// dadakan: audit saat kasir masih jualan · text: "Mozza −3, Mix −1" ·
// catatan: catatan operasional tanpa tag mode.
export function auditDelta(a) {
  const lines = (a?.rows || []).map((r) => ({
    name: r.parentName,
    sys: r.sys?.sisa ?? 0,
    riil: r.riil?.sisa ?? 0,
    selisih: (r.riil?.sisa ?? 0) - (r.sys?.sisa ?? 0),
  }))
  const beda = lines.filter((l) => l.selisih !== 0)
  const dadakan = (a?.note || '').startsWith('[Audit DADAKAN')
  const text = beda.map((l) => `${l.name} ${l.selisih > 0 ? '+' : '−'}${Math.abs(l.selisih)}`).join(', ')
  const catatan = (a?.note || '').replace(/^\[[^\]]*\]\s*/, '').trim()
  return { lines, beda, dadakan, text, catatan }
}

export function submitAudit({ branchId, branchName, rows, note }) {
  const checked = (rows || []).map((r) => ({
    ...r,
    cocok:
      r.sys.sisa === r.riil.sisa &&
      r.sys.patah === r.riil.patah &&
      r.sys.hilang === r.riil.hilang,
  }))
  const audit = {
    id: 'AUD-' + Date.now(),
    branchId,
    branchName: branchName || branchId,
    note: (note || '').trim(),
    rows: checked,
    allCocok: checked.every((r) => r.cocok),
    createdAt: new Date().toISOString(),
  }
  commit([audit, ...list])
  return audit
}
