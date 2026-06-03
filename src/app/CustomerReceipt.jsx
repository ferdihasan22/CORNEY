import { useNavigate, useParams } from 'react-router-dom'
import { BRANCHES, SAUCES, fmtRp } from '../data/menu.js'
import { useMaster } from '../store/useMaster.js'
import { useDay } from '../store/useDay.js'

// 1C.5 — CORNEY App Customer · Struk Digital (CUS-04). Ported from Stitch
// "struk_digital_corney_app". Reached by scanning the QR on the printed receipt
// (real cross-device fetch = backend, TAHAP 4); in Fase 1 it reads the sale from
// this device's open day by id, and falls back to a sample so the screen is
// always viewable. The pickup PIN (online-order concept) only shows when a sale
// carries one; walk-in shows the order number. Promo line only when discounted.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

const PAY = {
  lunas: { label: 'Tunai · Lunas', ok: true },
  terverifikasi: { label: 'QRIS Midtrans · Lunas', ok: true },
  terklaim: { label: 'QRIS GoPay · Lunas', ok: true },
  gofood: { label: 'GoFood', ok: true },
  grabfood: { label: 'GrabFood', ok: true },
  pending_payment: { label: 'Belum dibayar', ok: false },
}

const SAMPLE = {
  id: 'demo', no: 14, ts: new Date().toISOString(), status: 'terverifikasi', total: 38000, discount: 0,
  lines: [{ menuId: 'mozza_ori', qty: 2, sauces: [{ id: 'tomat' }, { id: 'sambal' }] }],
}

export default function CustomerReceipt() {
  const { saleId } = useParams()
  const navigate = useNavigate()
  const master = useMaster()
  const day = useDay()

  const found = (day?.sales || []).find((s) => s.id === saleId)
  const sale = found || SAMPLE
  const isSample = !found
  const branch = BRANCHES.find((b) => b.id === day?.branchId) || BRANCHES[0]
  const menuName = (id) => master?.menus?.find((m) => m.id === id)?.name || id
  const menuPrice = (id) => master?.menus?.find((m) => m.id === id)?.price || 0
  const sauceNames = (arr) => (arr || []).map((s) => SAUCES.find((x) => x.id === s.id)?.name || s.id).join(', ')
  const lineTotal = (l) => {
    const paid = (l.sauces || []).reduce((sum, s) => sum + (SAUCES.find((x) => x.id === s.id)?.price || 0), 0)
    return (menuPrice(l.menuId) + paid) * l.qty
  }
  const pay = PAY[sale.status] || PAY.lunas
  const dt = new Date(sale.ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const share = async () => {
    const text = `Struk CORNEY #${String(sale.no).padStart(3, '0')} — ${fmtRp(sale.total)}`
    try {
      if (navigator.share) await navigator.share({ title: 'Struk CORNEY', text, url: location.href })
      else { await navigator.clipboard.writeText(location.href); alert('Link struk disalin.') }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-40">
      <header className="sticky top-0 z-50 bg-surface shadow-sm flex items-center h-[64px] px-4 gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90"><Icon name="arrow_back" /></button>
        <h1 className="font-headline-md text-headline-md flex-1">Struk Digital</h1>
        <button onClick={share} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="share" /></button>
        <button onClick={() => window.print()} className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:scale-90"><Icon name="download" /></button>
      </header>

      <main className="max-w-[480px] mx-auto px-4 mt-6 flex flex-col items-center">
        {isSample && <p className="text-xs text-on-surface-variant italic mb-3">Contoh struk — buka dari pesanan nyata lewat QR di struk cetak.</p>}

        {/* Receipt card (.receipt-area = print-isolated, reuses index.css @media print) */}
        <div className="receipt-area bg-surface-container-lowest w-full pt-8 pb-8 px-6 rounded-2xl shadow-[0_4px_16px_rgba(26,26,26,0.08)] flex flex-col items-center">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mb-2 shadow-lg"><Icon name="restaurant" fill className="text-white !text-4xl" /></div>
            <h2 className="font-headline-md text-headline-md text-primary-container">{branch.name}</h2>
            <p className="font-body-md text-on-surface-variant opacity-75">Outlet Balikpapan</p>
          </div>

          <hr className="border-0 border-t-2 border-dashed border-surface-variant w-full my-4" />

          <div className="w-full flex justify-between text-sm">
            <p className="text-on-surface-variant">{dt}</p>
            <p className="font-mono font-bold">#{String(sale.no).padStart(3, '0')}</p>
          </div>

          <hr className="border-0 border-t-2 border-dashed border-surface-variant w-full my-4" />

          <div className="w-full space-y-3 mb-4">
            {sale.lines.map((l, i) => (
              <div key={i} className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-label-lg text-on-surface">{l.qty}x {menuName(l.menuId)}</p>
                  {sauceNames(l.sauces) && <p className="font-label-md text-on-surface-variant italic">{sauceNames(l.sauces)}</p>}
                </div>
                <p className="font-mono text-on-surface font-semibold shrink-0">{fmtRp(lineTotal(l))}</p>
              </div>
            ))}
            {sale.discount > 0 && (
              <div className="flex justify-between items-center text-green-700"><p className="font-label-md">Diskon Promo</p><p className="font-mono font-semibold">−{fmtRp(sale.discount)}</p></div>
            )}
          </div>

          <hr className="border-0 border-t-2 border-dashed border-surface-variant w-full my-4" />

          <div className="w-full mb-6">
            <div className="flex justify-between items-end mb-4">
              <p className="font-headline-md text-headline-md">TOTAL</p>
              <p className="font-mono text-headline-md font-bold text-primary">{fmtRp(sale.total)}</p>
            </div>
            <div className="flex justify-center">
              <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 ${pay.ok ? 'bg-green-100 text-green-800' : 'bg-secondary-container text-on-secondary-container'}`}>
                <Icon name={pay.ok ? 'check_circle' : 'schedule'} fill className="text-sm" />
                <span className="font-label-md uppercase tracking-wide">{pay.label}</span>
              </div>
            </div>
          </div>

          {sale.pin ? (
            <div className="w-full bg-secondary-container rounded-xl p-4 flex flex-col items-center mb-6 border-2 border-dashed border-secondary">
              <p className="font-label-md text-on-secondary-fixed-variant mb-1">Ambil pesanan dengan PIN</p>
              <p className="font-mono text-4xl font-extrabold text-on-secondary-fixed tracking-[0.2em]">{sale.pin}</p>
            </div>
          ) : (
            <div className="w-full bg-surface-container-low rounded-xl p-4 flex items-center justify-center gap-2 mb-6 border border-outline-variant">
              <Icon name="confirmation_number" className="text-on-surface-variant" />
              <p className="font-label-md text-on-surface-variant">Tunjukkan no. <span className="font-mono font-bold">#{String(sale.no).padStart(3, '0')}</span> di kasir</p>
            </div>
          )}

          <div className="text-center space-y-1">
            <p className="font-label-md text-on-surface-variant font-bold italic">Terima kasih! #CeritanyaBersamaCorney</p>
            <p className="text-xs text-on-surface-variant opacity-60">Komplain? DM IG @corney.idn</p>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-surface shadow-[0_-4px_16px_rgba(26,26,26,0.08)] p-5 z-50 flex flex-col gap-3 max-w-[480px] mx-auto print:hidden">
        <button onClick={share} className="h-[52px] w-full bg-primary-container text-white rounded-xl font-headline-md shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><Icon name="share" /> Bagikan Struk</button>
        <button onClick={() => window.print()} className="h-[52px] w-full border-2 border-primary text-primary rounded-xl font-headline-md active:bg-surface-container-low transition-all flex items-center justify-center gap-2"><Icon name="download" /> Simpan</button>
      </div>
    </div>
  )
}
