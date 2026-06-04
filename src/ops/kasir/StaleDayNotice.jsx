import { useNavigate } from 'react-router-dom'
import { BRANCHES } from '../../data/menu.js'
import { useDay } from '../../store/useDay.js'
import { daySalesCount, dayDateDD, dayDateISO, todayDD, setReportDate, endDay, startDay } from '../../store/day.js'

// Tampil saat HARI BASI: sesi kasir masih terbuka tapi tanggalnya bukan hari ini
// (kasir lupa Closing & hari sudah berganti). Cegah jualan baru tercampur ke hari
// kemarin + cegah data kemarin hilang tak masuk laporan.
//   - Ada transaksi kemarin → WAJIB Closing dulu (data kemarin diselamatkan).
//   - Belum ada transaksi    → boleh langsung mulai hari baru.
const Icon = ({ name, className = '' }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>

export default function StaleDayNotice() {
  const navigate = useNavigate()
  const day = useDay()
  const branch = BRANCHES.find((b) => b.id === day?.branchId)
  const kemarin = dayDateDD()
  const sekarang = todayDD()
  const jumlah = daySalesCount()
  const adaTransaksi = jumlah > 0

  function lanjutClosing() {
    // Kunci tanggal laporan ke tanggal SESI (kemarin) supaya laporan masuk ke
    // hari yang benar, bukan hari ini.
    setReportDate(dayDateISO())
    navigate('/ops/kasir/closing/belanja')
  }
  function mulaiHariBaru() {
    const b = day?.branchId
    endDay() // buang sesi kosong kemarin
    if (b) startDay(b) // sesi baru hari ini (Opening)
    navigate('/ops/kasir')
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center p-margin-page">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl border-2 border-amber-300 shadow-[0_4px_24px_rgba(26,26,26,0.10)] overflow-hidden">
        <div className="bg-amber-100 px-6 py-5 flex items-center gap-3">
          <Icon name="event_busy" className="!text-[32px] text-amber-700" />
          <div>
            <h1 className="font-headline-md text-headline-md text-amber-900">Hari belum ditutup</h1>
            <p className="text-label-md text-amber-800">{branch?.name || 'Cabang ini'}</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-surface-container rounded-xl p-4 text-center">
            <p className="text-label-md text-on-surface-variant">Sesi yang masih terbuka dari</p>
            <p className="font-display-md text-[28px] text-primary font-extrabold tracking-tight">{kemarin}</p>
            <p className="text-label-md text-on-surface-variant mt-1">sekarang sudah <b>{sekarang}</b></p>
          </div>

          {adaTransaksi ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-900">
                <Icon name="info" className="!text-[20px] shrink-0 mt-0.5" />
                <p className="text-label-lg leading-snug">Ada <b>{jumlah} transaksi</b> di hari {kemarin} yang <b>belum tercatat ke laporan</b>. Selesaikan <b>Closing</b> dulu supaya datanya aman & masuk ke hari yang benar — baru bisa buka hari baru.</p>
              </div>
              <button onClick={lanjutClosing} className="w-full h-[56px] rounded-2xl bg-primary text-on-primary font-headline-md flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg">
                <Icon name="nightlight" /> Selesaikan Closing {kemarin}
              </button>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-blue-900">
                <Icon name="info" className="!text-[20px] shrink-0 mt-0.5" />
                <p className="text-label-lg leading-snug">Belum ada transaksi di sesi kemarin, jadi tidak ada data yang perlu diselamatkan. Kamu bisa langsung <b>mulai hari baru</b>.</p>
              </div>
              <button onClick={mulaiHariBaru} className="w-full h-[56px] rounded-2xl bg-primary text-on-primary font-headline-md flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg">
                <Icon name="wb_sunny" /> Mulai Hari Baru ({sekarang})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
