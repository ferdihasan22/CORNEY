import { useState } from 'react'
import { MENUS, fmtRp } from '../../data/menu.js'
import { useBtPrinter } from './useBtPrinter.js'
import { btSupported, btConnected, btConnect, btDeviceName, btPrintReceipt, btTestPrint, isNativePrinter } from './btprinter.js'
import { openPrinterPicker } from './printerPickerStore.js'

// Step 1A.15 — STR-01 Struk Ringkas (thermal/digital). Concise: CORNEY + branch,
// order no + date/time, items, total, method, change, footer
// #CeritanyaBersamaCorney + complaint IG. Reprint marked "CETAK ULANG".
// No reference Stitch screen for the kasir thermal slip — designed to spec.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

const METHOD = { tunai: 'Tunai', qris_midtrans: 'QRIS Midtrans', qris_gopay: 'QRIS GoPay', gofood: 'GoFood', grabfood: 'GrabFood' }
// Harga beku per-baris (override per-cabang yg ditagih saat jual); fallback ke harga
// global utk transaksi lama yg belum simpan l.price.
const baseOf = (l) => (l.price != null ? l.price : (MENUS.find((m) => m.id === l.menuId)?.price ?? 0))
const sauceOf = (l) => l.sauces.reduce((s, x) => s + (x.price || 0), 0)

export default function Receipt({ sale, branch, onClose, reprint = false }) {
  const dt = new Date(sale.ts)
  const connected = useBtPrinter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const cetak = async () => {
    if (btConnected()) {
      try { setBusy(true); setMsg(''); await btPrintReceipt(sale, branch, MENUS, reprint); setMsg('✓ Tercetak ke printer.') }
      catch (e) { setMsg('Gagal cetak: ' + (e.message || '')) } finally { setBusy(false) }
    } else { window.print() }
  }
  const hubungkan = async () => {
    if (isNativePrinter) { openPrinterPicker(); return } // APK: pemilih printer Bluetooth Classic
    try { setBusy(true); setMsg(''); const n = await btConnect(); setMsg('✓ Terhubung: ' + n) }
    catch (e) { setMsg(e.message || 'Dibatalkan / gagal konek.') } finally { setBusy(false) }
  }
  const testPrint = async () => { try { setBusy(true); await btTestPrint(); setMsg('✓ Test terkirim.') } catch (e) { setMsg('Gagal: ' + (e.message || '')) } finally { setBusy(false) } }
  const Row = ({ l, v, bold }) => (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}><span>{l}</span><span>{v}</span></div>
  )

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-blur-overlay p-4 receipt-overlay" onClick={onClose}>
      <div className="w-full max-w-[340px] bg-white rounded-xl shadow-[0_16px_32px_rgba(26,26,26,0.12)] overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Printable area — scrolls when the order is long */}
        <div className="receipt-area flex-1 overflow-y-auto hide-scrollbar p-6 font-mono text-[13px] text-on-surface leading-relaxed">
          <div className="text-center">
            <p className="font-display-md text-2xl font-black text-primary tracking-tighter">CORNEY</p>
            <p className="font-bold">{branch.name}</p>
            <p className="text-[11px] text-on-surface-variant">{branch.address}</p>
            {reprint && <p className="mt-1 inline-block border border-on-surface px-2 text-[11px] font-bold">— CETAK ULANG —</p>}
          </div>

          <div className="my-3 border-t border-dashed border-on-surface/40" />
          <Row l="No." v={sale.id} />
          <Row l="Tanggal" v={dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <Row l="Jam" v={dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} />
          <Row l="Kasir" v={branch.username} />
          <div className="my-3 border-t border-dashed border-on-surface/40" />

          {sale.lines.map((l) => {
            const m = MENUS.find((x) => x.id === l.menuId)
            return (
              <div key={l.sig} className="mb-1.5">
                <Row l={`${l.qty}x ${m?.name ?? l.menuId}`} v={fmtRp(baseOf(l) * l.qty)} />
                {l.sauces.map((s) => (
                  <div key={s.id} className="flex justify-between text-[11px] text-on-surface-variant pl-3">
                    <span>+ {s.name}</span><span>{s.price > 0 ? fmtRp(s.price * l.qty) : 'gratis'}</span>
                  </div>
                ))}
              </div>
            )
          })}

          <div className="my-3 border-t border-dashed border-on-surface/40" />
          <Row l="Subtotal" v={fmtRp(sale.subtotal)} />
          {sale.biaya > 0 && <Row l="Biaya Tambahan" v={fmtRp(sale.biaya)} />}
          <div className="mt-1 text-base"><Row l="TOTAL" v={fmtRp(sale.total)} bold /></div>
          <div className="my-3 border-t border-dashed border-on-surface/40" />

          {sale.paid ? (
            <>
              <Row l="Metode" v={METHOD[sale.method] || '-'} />
              {sale.method === 'tunai' && (
                <>
                  <Row l="Tunai" v={fmtRp(sale.cashReceived)} />
                  <Row l="Kembalian" v={fmtRp(sale.change)} bold />
                </>
              )}
            </>
          ) : (
            <p className="text-center font-bold border border-on-surface py-1">BELUM BAYAR — bayar saat ambil</p>
          )}

          <div className="mt-4 text-center text-[11px]">
            <p className="font-bold">#CeritanyaBersamaCorney</p>
            <p className="text-on-surface-variant">Komplain? DM IG @corney.idn</p>
          </div>
        </div>

        {/* Actions (not printed) */}
        <div className="receipt-actions shrink-0 p-4 border-t border-outline-variant bg-surface-container-low">
          {/* Status printer Bluetooth (Web Bluetooth / BLE) */}
          {btSupported() ? (
            connected ? (
              <div className="flex items-center gap-2 mb-3 text-[12px] text-green-700">
                <Icon name="bluetooth_connected" className="!text-[16px]" /> <span className="flex-1 truncate"><b>{btDeviceName() || 'Printer'}</b> terhubung</span>
                <button onClick={testPrint} disabled={busy} className="text-primary font-bold underline underline-offset-2">Test</button>
              </div>
            ) : (
              <button onClick={hubungkan} disabled={busy} className="w-full mb-3 py-2.5 rounded-lg border-2 border-primary text-primary font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                <Icon name="bluetooth_searching" /> {busy ? 'Mencari…' : 'Hubungkan Printer (Bluetooth)'}
              </button>
            )
          ) : (
            <div className="flex items-start gap-2 mb-3 text-[11px] text-on-surface-variant leading-snug">
              <Icon name="info" className="!text-[16px] text-primary shrink-0 mt-0.5" />
              <span>Browser ini tak mendukung Web Bluetooth (pakai <b>Android Chrome</b>), atau gunakan <b>RawBT</b> lalu tekan Cetak Struk.</span>
            </div>
          )}
          {msg && <p className="text-[11px] text-center mb-2 text-on-surface-variant">{msg}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-3 rounded-lg border border-outline-variant text-on-surface-variant font-semibold">Tutup</button>
            <button onClick={cetak} disabled={busy} className="flex-1 corney-swirl text-on-primary py-3 rounded-lg font-bold flex items-center justify-center gap-2 active:scale-[.99] disabled:opacity-60">
              <Icon name="print" /> {connected ? 'Cetak Struk (BT)' : 'Cetak Struk'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
