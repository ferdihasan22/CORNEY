import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppConfig } from '../../store/useAppConfig.js'
import { setAppConfigField, normalizeWa } from '../../store/appconfig.js'

// OWN — Pengaturan Aplikasi (setelan GLOBAL, berlaku semua cabang). Saat ini berisi
// nomor WhatsApp tujuan komplain customer. Tersimpan ke app_config (Supabase) →
// langsung dipakai app customer (Lacak & Riwayat) lintas perangkat.
const Icon = ({ name, className = '', fill }) => (
  <span style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined} className={`material-symbols-outlined ${className}`}>{name}</span>
)

export default function OwnerSettings() {
  const navigate = useNavigate()
  const cfg = useAppConfig()
  const [wa, setWa] = useState('')
  const [saved, setSaved] = useState(false)

  // Sinkronkan input dengan nilai tersimpan (termasuk saat hidrasi dari server).
  useEffect(() => { setWa(cfg.complaint_wa || '') }, [cfg.complaint_wa])

  const norm = normalizeWa(wa)
  const valid = norm.startsWith('62') && norm.length >= 10 && norm.length <= 15
  const dirty = norm !== (cfg.complaint_wa || '')

  const save = () => {
    if (!valid || !dirty) return
    setAppConfigField('complaint_wa', norm)
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  // Link tombol GoFood / GrabFood di landing Customer. Kosong = tombol disembunyikan.
  const [gofood, setGofood] = useState('')
  const [grabfood, setGrabfood] = useState('')
  const [savedLink, setSavedLink] = useState(false)
  useEffect(() => { setGofood(cfg.gofood_url ?? '') }, [cfg.gofood_url])
  useEffect(() => { setGrabfood(cfg.grabfood_url ?? '') }, [cfg.grabfood_url])
  const linkDirty = gofood.trim() !== (cfg.gofood_url ?? '') || grabfood.trim() !== (cfg.grabfood_url ?? '')
  const saveLinks = () => {
    if (!linkDirty) return
    setAppConfigField('gofood_url', gofood.trim())
    setAppConfigField('grabfood_url', grabfood.trim())
    setSavedLink(true); setTimeout(() => setSavedLink(false), 2500)
  }

  // Biaya Layanan ONLINE (per order). on/off + nominal. Global semua cabang. Walk-in
  // TIDAK kena. Disimpan sbg string di app_config.
  const [feeOn, setFeeOn] = useState(false)
  const [feeAmt, setFeeAmt] = useState('1000')
  const [savedFee, setSavedFee] = useState(false)
  useEffect(() => { setFeeOn((cfg.service_fee_on ?? '0') === '1') }, [cfg.service_fee_on])
  useEffect(() => { setFeeAmt(String(cfg.service_fee_amount ?? '1000')) }, [cfg.service_fee_amount])
  const feeNum = Math.max(0, Math.round(Number(feeAmt) || 0))
  const feeDirty = (feeOn ? '1' : '0') !== (cfg.service_fee_on ?? '0') || String(feeNum) !== String(cfg.service_fee_amount ?? '1000')
  const saveFee = () => {
    if (!feeDirty) return
    setAppConfigField('service_fee_on', feeOn ? '1' : '0')
    setAppConfigField('service_fee_amount', String(feeNum))
    setSavedFee(true); setTimeout(() => setSavedFee(false), 2500)
  }

  // Tampilan nomor enak dibaca: 62 851-7420-0152
  const pretty = (d) => {
    if (!d) return '—'
    const rest = d.slice(2)
    const a = rest.slice(0, 3), b = rest.slice(3, 7), c = rest.slice(7)
    return `62 ${[a, b, c].filter(Boolean).join('-')}`
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <header className="bg-primary text-on-primary px-5 pt-5 pb-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ops/owner')} className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center active:scale-95"><Icon name="arrow_back" /></button>
          <h1 className="font-headline-lg text-headline-lg flex-1">Pengaturan Aplikasi</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-5 space-y-4">
        {/* Nomor komplain */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/40 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0"><Icon name="support_agent" /></div>
            <div>
              <h2 className="font-label-lg text-on-surface">Nomor WhatsApp Komplain</h2>
              <p className="text-[12px] text-on-surface-variant leading-snug">Tujuan tombol <b>“Komplain pesanan”</b> di app customer (Lacak &amp; Riwayat). <b>Satu nomor untuk semua cabang.</b></p>
            </div>
          </div>

          <label className="text-[11px] font-bold text-on-surface-variant uppercase">Nomor WhatsApp</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"><Icon name="call" className="!text-[18px]" /></span>
            <input
              inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)}
              placeholder="0851-7420-0152"
              className={`w-full h-12 pl-10 pr-3 rounded-xl border outline-none font-bold tracking-wide ${valid || !wa ? 'border-outline focus:border-primary bg-surface' : 'border-error bg-error-container/20'}`}
            />
          </div>
          {!valid && wa ? (
            <p className="text-[11px] text-error mt-1.5 flex items-center gap-1"><Icon name="error" className="!text-[14px]" /> Nomor belum valid. Contoh: 0851-7420-0152</p>
          ) : (
            <p className="text-[11px] text-on-surface-variant mt-1.5">Tersimpan sebagai: <b className="text-on-surface">{pretty(norm)}</b> · format WhatsApp <span className="font-mono">{norm || '—'}</span></p>
          )}

          <button onClick={save} disabled={!valid || !dirty}
            className="mt-4 w-full h-12 rounded-xl bg-primary text-on-primary font-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40">
            <Icon name={saved ? 'check_circle' : 'save'} className="!text-[20px]" /> {saved ? 'Tersimpan!' : dirty ? 'Simpan Nomor' : 'Tersimpan'}
          </button>
          {dirty && valid && <p className="text-[11px] text-amber-700 mt-2 flex items-center gap-1"><Icon name="info" className="!text-[14px]" /> Ada perubahan belum disimpan.</p>}
        </section>

        {/* Link GoFood / GrabFood di landing */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/40 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0"><Icon name="link" /></div>
            <div>
              <h2 className="font-label-lg text-on-surface">Link GoFood &amp; GrabFood</h2>
              <p className="text-[12px] text-on-surface-variant leading-snug">Tujuan tombol <b>“Pesan di GoFood/GrabFood”</b> di halaman depan Customer. <b>Kosongkan</b> untuk menyembunyikan tombolnya.</p>
            </div>
          </div>

          <label className="text-[11px] font-bold text-on-surface-variant uppercase">Link GoFood</label>
          <input type="url" inputMode="url" value={gofood} onChange={(e) => setGofood(e.target.value)} placeholder="https://gofood.co.id/…"
            className="w-full h-12 px-3 mt-1 rounded-xl border border-outline focus:border-primary outline-none bg-surface text-sm" />

          <label className="text-[11px] font-bold text-on-surface-variant uppercase mt-3 block">Link GrabFood</label>
          <input type="url" inputMode="url" value={grabfood} onChange={(e) => setGrabfood(e.target.value)} placeholder="https://food.grab.com/…"
            className="w-full h-12 px-3 mt-1 rounded-xl border border-outline focus:border-primary outline-none bg-surface text-sm" />

          <button onClick={saveLinks} disabled={!linkDirty}
            className="mt-4 w-full h-12 rounded-xl bg-primary text-on-primary font-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40">
            <Icon name={savedLink ? 'check_circle' : 'save'} className="!text-[20px]" /> {savedLink ? 'Tersimpan!' : linkDirty ? 'Simpan Link' : 'Tersimpan'}
          </button>
        </section>

        {/* Biaya Layanan (online) */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/40 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0"><Icon name="receipt_long" /></div>
            <div className="flex-1">
              <h2 className="font-label-lg text-on-surface">Biaya Layanan (Pesanan Online)</h2>
              <p className="text-[12px] text-on-surface-variant leading-snug">Biaya tetap <b>per pesanan online</b> di app Customer. <b>Kasir walk-in TIDAK kena.</b></p>
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
            <span className="font-label-md text-on-surface">Aktifkan biaya layanan</span>
            <button type="button" onClick={() => setFeeOn((v) => !v)} className={`w-12 h-7 rounded-full p-1 transition-colors ${feeOn ? 'bg-primary' : 'bg-surface-container-high'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${feeOn ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <label className="text-[11px] font-bold text-on-surface-variant uppercase mt-2 block">Nominal per order</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-bold">Rp</span>
            <input inputMode="numeric" value={feeAmt ? Number(String(feeAmt).replace(/\D/g, '')).toLocaleString('id-ID') : ''} onChange={(e) => setFeeAmt(e.target.value.replace(/\D/g, ''))} placeholder="1.000" disabled={!feeOn}
              className={`w-full h-12 pl-10 pr-3 rounded-xl border outline-none font-bold tracking-wide ${feeOn ? 'border-outline focus:border-primary bg-surface' : 'border-outline-variant bg-surface-container-high text-on-surface-variant'}`} />
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1.5">{feeOn && feeNum > 0 ? <>Customer membayar <b className="text-on-surface">+{`Rp${feeNum.toLocaleString('id-ID')}`}</b> tiap pesanan online.</> : 'Nonaktif — tak ada biaya layanan.'}</p>

          <button onClick={saveFee} disabled={!feeDirty}
            className="mt-4 w-full h-12 rounded-xl bg-primary text-on-primary font-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40">
            <Icon name={savedFee ? 'check_circle' : 'save'} className="!text-[20px]" /> {savedFee ? 'Tersimpan!' : feeDirty ? 'Simpan Biaya Layanan' : 'Tersimpan'}
          </button>
        </section>

        <p className="text-[12px] text-on-surface-variant/70 leading-relaxed px-1">Perubahan langsung berlaku ke semua app customer (tersimpan di server &amp; ter-update otomatis tanpa mereka perlu refresh).</p>
      </main>
    </div>
  )
}
