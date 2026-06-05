import { useEffect, useState, useSyncExternalStore } from 'react'
import { isPickerOpen, subscribePicker, closePrinterPicker } from './printerPickerStore.js'
import { isNativePrinter } from './btprinter.js'
import { scanPrinters, connectAddress } from './btprinter.native.js'

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
)

// Modal pemilih printer (HANYA native/APK). Memindai printer terdekat (plugin
// memfilter hanya perangkat kelas printer), lalu user tap untuk menghubungkan.
// Dipasang global di App; dibuka via openPrinterPicker(). No-op di web/PWA.
export default function PrinterPicker() {
  const open = useSyncExternalStore(subscribePicker, isPickerOpen)
  const [devices, setDevices] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open || !isNativePrinter) return
    let alive = true
    let stop = null
    setDevices([]); setErr(''); setBusy(false)
    scanPrinters((list) => { if (alive) setDevices(list) })
      .then((s) => { if (alive) stop = s; else s() })
      .catch((e) => { if (alive) setErr(e.message || 'Gagal memindai.') })
    return () => { alive = false; if (stop) stop() }
  }, [open])

  if (!open || !isNativePrinter) return null

  const pick = async (d) => {
    setBusy(true); setErr('')
    try { await connectAddress(d.address, d.name); closePrinterPicker() }
    catch (e) { setErr(e.message || 'Gagal menghubungkan.'); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40" onClick={() => !busy && closePrinterPicker()}>
      <div className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <Icon name="print" className="text-primary" />
            <span className="font-bold text-on-surface">Pilih Printer Bluetooth</span>
          </div>
          <button onClick={() => !busy && closePrinterPicker()} className="p-1 rounded-lg hover:bg-surface-variant disabled:opacity-40" disabled={busy}><Icon name="close" /></button>
        </div>

        <div className="p-2 overflow-y-auto flex-1">
          {err && <div className="m-2 p-3 rounded-xl bg-error-container text-on-error-container text-sm">{err}</div>}

          {devices.length === 0 && !err && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-on-surface-variant">
              <Icon name="bluetooth_searching" className="!text-4xl animate-pulse" />
              <span className="text-sm">Memindai printer… pastikan printer menyala.</span>
            </div>
          )}

          {devices.map((d) => (
            <button key={d.address} onClick={() => pick(d)} disabled={busy}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant text-left disabled:opacity-50">
              <Icon name="print" className="text-on-surface-variant" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface truncate">{d.name || 'Printer'}</p>
                <p className="text-xs text-on-surface-variant">{d.address}</p>
              </div>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-outline-variant text-center text-xs text-on-surface-variant">
          {busy ? 'Menghubungkan…' : 'Printer harus sudah dipasangkan (pair) di Pengaturan Bluetooth Android.'}
        </div>
      </div>
    </div>
  )
}
