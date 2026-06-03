import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BRANCHES, fmtRp } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { PHASE, channelTotals, saveClosingReconcile } from '../../store/day.js'

// Step 1A.11 — CLS-03 Hitung Uang di Laci (langkah terakhir). UI ported from
// Stitch "closing_reconcile_cash_channels_corney_pos", sidebar stripped.
// Setoran tunai = penjualan tunai − uang urgent − refund (modal awal/kembalian
// DIPISAH, tidak digabung dengan penjualan). Channels with transactions checked.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

export default function ClosingReconcile() {
  const day = useDay()
  const navigate = useNavigate()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const { total, count } = channelTotals()

  const opening = day?.cash?.opening ?? 0
  const tunaiSales = total.tunai
  const urgent = day?.closing?.urgent?.total ?? 0
  const refund = day?.closing?.refund?.total ?? 0
  const gaji = day?.closing?.gaji?.total ?? 0
  const modalUsed = day?.closing?.modalUsed?.total ?? 0
  // Setoran tunai (kas dari penjualan, yang disetor) — modal awal TIDAK ikut;
  // urgent + refund + gaji harian karyawan adalah kas keluar dari laci.
  const setoran = tunaiSales - urgent - refund - gaji
  // Sisa modal/kembalian setelah dipakai (jika ada) — yang disisihkan utk besok.
  const modalSisa = Math.max(0, opening - modalUsed)

  const [modalAwal, setModalAwal] = useState(modalSisa) // uang kembalian tersisa, disisihkan
  const [fisik, setFisik] = useState(0) // KOSONG — kasir wajib hitung & isi sendiri
  const [gopayOk, setGopayOk] = useState(false)
  const [reason, setReason] = useState('')

  if (!day || !branch) return <Navigate to="/ops/kasir/login" replace />
  if (day.phase === PHASE.OPENING || day.phase === PHASE.CASH) return <Navigate to="/ops/kasir" replace />
  if (!day.closing?.recon) return <Navigate to="/ops/kasir/closing/rekon" replace />
  if (!day.closing?.urgent) return <Navigate to="/ops/kasir/closing/urgent" replace />

  // fisik = uang PENJUALAN TUNAI yang dihitung kasir (modal/kembalian SUDAH
  // disisihkan, tidak ikut). Selisih dicocokkan langsung dengan setoran.
  const kasPenjualanAktual = fisik
  const selisih = fisik - setoran
  const entered = fisik > 0 // kasir sudah hitung & isi?
  // CLS-05 (v56): cash must be EXACT — no tolerance. Any non-zero selisih needs a reason.
  const needsReason = entered && selisih !== 0
  const gopayPresent = total.qris_gopay > 0

  const NON_TUNAI = [
    { id: 'qris_gopay', label: 'QRIS GoPay', kind: 'gopay' },
    { id: 'qris_midtrans', label: 'QRIS Midtrans', kind: 'midtrans' },
    { id: 'gofood', label: 'GoFood', kind: 'platform', icon: 'delivery_dining' },
    { id: 'grabfood', label: 'GrabFood', kind: 'platform', icon: 'moped' },
  ]
  const shown = NON_TUNAI.filter((c) => total[c.id] > 0)
  const skipped = ['tunai', ...NON_TUNAI.map((c) => c.id)].filter((id) => (count[id] || 0) === 0).length

  const canContinue = entered && (!gopayPresent || gopayOk) && (!needsReason || reason.trim())

  function lanjut() {
    if (!canContinue) return
    saveClosingReconcile({ setoran, modalAwal, kasPenjualanTunai: fisik, fisikLaci: modalAwal + fisik, kasSeharusnya: setoran, selisih, gopayOk, channels: total, reason: reason.trim() })
    navigate('/ops/kasir/closing/laporan')
  }

  return (
    <div className="bg-background text-on-surface h-screen flex flex-col overflow-hidden">
      <header className="shrink-0 bg-primary text-on-primary shadow-md flex items-center justify-between px-margin-page h-[64px]">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/ops/kasir/closing/urgent')} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-primary-container active:scale-95 transition-transform">
            <Icon name="arrow_back" />
          </button>
          <h1 className="text-headline-md font-headline-md font-bold">Tutup Toko — Hitung Uang di Laci</h1>
        </div>
        <div className="text-label-md font-label-md uppercase tracking-wider opacity-90">Langkah 4/5</div>
      </header>

      <main className="flex-1 overflow-y-auto px-margin-page">
        <div className="max-w-4xl mx-auto py-8 grid grid-cols-1 gap-6">
          {/* Tunai */}
          <section className="bg-surface-container-lowest p-6 rounded-[14px] shadow-[0_4px_16px_rgba(26,26,26,0.08)] border-l-8 border-primary">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <Icon name="payments" className="text-primary text-[32px]" />
                <h2 className="text-headline-md font-headline-md">Tunai</h2>
              </div>
              {!entered ? (
                <div className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-label-md flex items-center gap-1"><Icon name="calculate" className="text-sm" /> Belum dihitung</div>
              ) : selisih === 0 ? (
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-label-md flex items-center gap-1"><Icon name="check_circle" className="text-sm" /> Pas</div>
              ) : (
                <div className="bg-error-container text-on-error-container px-3 py-1 rounded-full text-label-md flex items-center gap-1"><Icon name="warning" className="text-sm" /> Selisih</div>
              )}
            </div>
            <div className="bg-surface-container p-4 rounded-xl mb-5 text-on-surface text-body-md border border-outline-variant">
              <p className="font-bold mb-2">Uang yang harus disetor (hasil jualan tunai):</p>
              <div className="space-y-1 text-on-surface-variant">
                <div className="flex justify-between"><span>Hasil jualan tunai</span><span className="font-bold text-on-surface">{fmtRp(tunaiSales)}</span></div>
                <div className="flex justify-between"><span>− Uang Urgent</span><span>{fmtRp(urgent)}</span></div>
                <div className="flex justify-between"><span>− Uang balik ke pembeli</span><span>{fmtRp(refund)}</span></div>
                <div className="flex justify-between"><span>− Uang harian karyawan</span><span>{fmtRp(gaji)}</span></div>
                <div className="flex justify-between border-t border-outline-variant pt-1 mt-1 font-bold text-on-surface"><span>= Harus disetor</span><span className="text-primary">{fmtRp(setoran)}</span></div>
              </div>
              <p className="text-label-md mt-3 flex items-start gap-1.5 text-on-surface-variant"><Icon name="info" className="text-base shrink-0" /> Uang kembalian (modal buka toko) <b>jangan</b> dihitung di sini — itu disimpan buat besok.</p>
            </div>

            {/* Two inputs: modal awal (kembalian) kept aside + total physical cash */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-label-md font-label-md text-on-surface-variant mb-2">1. Uang modal (angsulan)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-headline-md font-bold text-on-surface-variant">Rp</span>
                  <input type="text" inputMode="numeric" value={modalAwal ? modalAwal.toLocaleString('id-ID') : ''} onChange={(e) => setModalAwal(Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="0" className="w-full h-[64px] pl-16 pr-4 rounded-[14px] border-2 border-outline focus:border-primary focus:ring-4 focus:ring-primary/10 text-headline-md font-bold text-on-surface outline-none" />
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1">{modalUsed > 0 ? <>Modal buka {fmtRp(opening)} − terpakai {fmtRp(modalUsed)} = sisa <b>{fmtRp(modalSisa)}</b>.</> : <>Biasanya sama dengan modal buka toko tadi pagi: {fmtRp(opening)}.</>}</p>
              </div>
              <div>
                <label className="block text-label-md font-label-md text-on-surface-variant mb-2">2. Hitung uang penjualan tunai (cash)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-headline-md font-bold text-on-surface">Rp</span>
                  <input type="text" inputMode="numeric" value={fisik ? fisik.toLocaleString('id-ID') : ''} onChange={(e) => setFisik(Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder={`Seharusnya ${fmtRp(setoran)}`} className="w-full h-[64px] pl-16 pr-4 rounded-[14px] border-2 border-primary focus:ring-4 focus:ring-primary/10 text-headline-md font-bold text-on-surface outline-none placeholder:text-on-surface-variant/50 placeholder:font-normal placeholder:text-body-md" />
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1">Uang kembalian sudah disisihkan — hitung sisa cash (hasil jualan) saja. Angka abu-abu = jumlah seharusnya.</p>
              </div>
            </div>
            {!entered ? (
              <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2 text-on-surface-variant">
                <Icon name="calculate" className="text-base" /> <span className="text-label-md">Sisihkan dulu uang kembalian, lalu hitung uang penjualan tunainya & isi. Cocokkan dengan angka abu-abu (seharusnya {fmtRp(setoran)}).</span>
              </div>
            ) : (
              <div className="bg-surface-container-low rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-label-md text-on-surface-variant"><span>Uang penjualan tunai (dihitung)</span><b className="text-on-surface">{fmtRp(kasPenjualanAktual)}</b></div>
                <div className="flex justify-between text-label-md text-on-surface-variant"><span>Seharusnya (setelah dikurangi urgent dll)</span><span>{fmtRp(setoran)}</span></div>
                <div className={`flex justify-between items-center pt-1 border-t border-outline-variant font-bold ${selisih === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span>{selisih === 0 ? 'Pas! Uang cocok 👍' : 'Ada beda (selisih)'}</span>
                  <span>{selisih > 0 ? '+' : ''}{fmtRp(selisih)}</span>
                </div>
              </div>
            )}
            {needsReason && (
              <div className="mt-4">
                <label className="block text-label-md font-label-md text-primary mb-1">Uang harus pas. Karena ada beda, tulis kenapa ya (nanti dilihat Owner) *</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows="2" placeholder="contoh: salah kasih kembalian / lupa catat uang keluar"
                  className="w-full p-3 bg-surface border border-outline rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none" />
              </div>
            )}
          </section>

          {/* Channels with transactions */}
          {shown.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {shown.map((c) => {
                if (c.kind === 'gopay') {
                  return (
                    <div key={c.id} className="bg-yellow-50 p-6 rounded-[14px] shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-yellow-200">
                      <div className="flex items-center gap-3 mb-2"><Icon name="qr_code_2" className="text-yellow-600" /><h3 className="text-headline-md font-headline-md text-yellow-900">QRIS GoPay</h3></div>
                      <p className="text-body-md text-yellow-800 mb-6">Total terklaim <span className="font-bold">{fmtRp(total.qris_gopay)}</span></p>
                      <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/50 rounded-lg hover:bg-white transition-colors">
                        <input type="checkbox" checked={gopayOk} onChange={(e) => setGopayOk(e.target.checked)} className="w-6 h-6 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500" />
                        <span className="text-label-lg font-label-lg text-yellow-900">Sudah cek mutasi &amp; cocok</span>
                      </label>
                    </div>
                  )
                }
                if (c.kind === 'midtrans') {
                  return (
                    <div key={c.id} className="bg-green-50 p-6 rounded-[14px] shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-green-200">
                      <div className="flex items-center gap-3 mb-2"><Icon name="check_circle" className="text-green-600" /><h3 className="text-headline-md font-headline-md text-green-900">QRIS Midtrans</h3></div>
                      <p className="text-body-md text-green-800"><span className="font-bold">Terverifikasi otomatis {fmtRp(total.qris_midtrans)}</span><br /><span className="text-label-md opacity-75">tidak perlu hitung manual</span></p>
                      <div className="mt-4 flex items-center text-green-600"><Icon name="bolt" className="text-sm mr-1" /><span className="text-label-md">Real-time settlement</span></div>
                    </div>
                  )
                }
                return (
                  <div key={c.id} className="bg-surface-container-high p-6 rounded-[14px] shadow-[0_4px_16px_rgba(26,26,26,0.08)] border border-outline-variant">
                    <div className="flex items-center gap-3 mb-2"><Icon name={c.icon} className="text-on-surface-variant" /><h3 className="text-headline-md font-headline-md text-on-surface">{c.label}</h3></div>
                    <p className="text-body-md text-on-surface-variant">Dicocokkan dengan catatan otomatis · <span className="font-bold">{fmtRp(total[c.id])}</span></p>
                    <p className="text-label-md mt-4 text-on-surface-variant/60">Estimasi pencairan: 24 jam</p>
                  </div>
                )
              })}
            </div>
          )}

          {skipped > 0 && (
            <div className="w-full flex items-center justify-between p-4 bg-surface-container rounded-[14px] text-on-surface-variant">
              <span className="text-label-lg font-label-lg">Dilewati ({skipped} channel · 0 transaksi)</span>
              <Icon name="block" />
            </div>
          )}
        </div>
      </main>

      <footer className="shrink-0 bg-white border-t border-outline-variant px-margin-page py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-start gap-3 max-w-xl">
          <Icon name="info" className="text-secondary pt-1" />
          <p className="text-label-md font-label-md text-on-surface-variant">
            Uang harus <b>PAS</b> sampai rupiah terakhir. <span className="text-primary font-bold">Kalau ada beda sedikit pun, tulis alasannya — Owner akan lihat.</span>
          </p>
        </div>
        <button onClick={lanjut} disabled={!canContinue} className="h-[52px] px-8 bg-primary text-on-primary rounded-[14px] font-bold text-label-lg shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40 shrink-0">
          Lanjut: Laporan Tutup Hari <Icon name="arrow_forward" />
        </button>
      </footer>
    </div>
  )
}
