# Setup Notifikasi Kasir (Fase A lokal + Fase B push FCM)

Dokumen ini menjelaskan cara mengaktifkan **dua jenis** notifikasi kasir di APK:

| Jenis | Alert | Butuh setup? |
|---|---|---|
| **Lokal** (Fase A) | "Gorengan matang / angkat" | ❌ Tidak — sudah aktif begitu APK ter-build |
| **Push FCM** (Fase B) | "Order online masuk" (saat app di-background/ditutup) | ✅ Ya — perlu Firebase + Supabase (langkah di bawah) |

> Sebelum Firebase disiapkan, kode push **inert** (diam, ditangkap try/catch) — app tetap normal. Notif "angkat" tetap jalan.

---

## Fase A — Notif lokal "angkat" (tak perlu apa-apa)
Sudah otomatis aktif. Saat install APK pertama kali, Android 13+ akan meminta **izin notifikasi** — ketuk **Izinkan**. Selesai. Alarm "gorengan matang" akan berbunyi (suara `sudah_goreng`) walau app di-background/ditutup.

---

## Fase B — Push "order online masuk" (FCM)

### Langkah 1 — Buat project Firebase (gratis)
1. Buka https://console.firebase.google.com → **Add project** (boleh pakai akun Google-mu). Nama bebas, mis. `CORNEY`.
2. Google Analytics boleh **dimatikan** (tak perlu).

### Langkah 2 — Daftarkan app Android
1. Di project Firebase → ikon **Android** (Add app).
2. **Android package name** harus PERSIS: `id.corney.kasir`
3. Nickname bebas (mis. "CORNEY Kasir"). SHA-1 boleh dikosongkan (FCM tak wajib).
4. **Download `google-services.json`** → taruh di: `android/app/google-services.json`

### Langkah 3 — Aktifkan plugin google-services di Gradle
Edit DUA file (sekali saja). **Lakukan hanya SETELAH `google-services.json` ada**, karena build akan gagal bila file belum ada.

**`android/build.gradle`** (level project) — di dalam blok `dependencies { ... }` bagian `buildscript`:
```gradle
    dependencies {
        classpath 'com.android.tools.build:gradle:8.7.2'
        classpath 'com.google.gms:google-services:4.4.2'   // ← TAMBAH baris ini
    }
```

**`android/app/build.gradle`** — tambahkan di baris paling bawah:
```gradle
apply plugin: 'com.google.gms.google-services'
```

> File `google-services.json` & gradle ini sengaja **tidak di-commit** (rahasia per-project). Lihat `.gitignore`.

### Langkah 4 — Service Account (kredensial server kirim push)
1. Firebase Console → ⚙️ **Project settings** → tab **Service accounts**.
2. **Generate new private key** → unduh file JSON (rahasia! jangan commit).
3. Buka isi file, salin SELURUHNYA (1 JSON utuh).

### Langkah 5 — Set secret di Supabase
Di Supabase Dashboard → **Edge Functions → Secrets** (atau CLI), tambahkan:

| Secret | Isi |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT` | tempel seluruh JSON service account (Langkah 4) |
| `NOTIFY_HOOK_SECRET` | string acak panjang (mis. hasil `openssl rand -hex 24`) — simpan, dipakai Langkah 7 |

CLI alternatif:
```bash
supabase secrets set NOTIFY_HOOK_SECRET=xxxxx
supabase secrets set GOOGLE_SERVICE_ACCOUNT="$(cat service-account.json)"
```

### Langkah 6 — Terapkan migration + deploy function
> ⚠️ Menyentuh Supabase **produksi**. Pastikan benar sebelum jalan.
```bash
# tabel device_tokens + RPC register/unregister
supabase db push        # atau apply migration 20260605150000_device_tokens_push.sql

# Edge Function (TANPA verify_jwt — dipanggil oleh DB, bukan user)
supabase functions deploy notify-order --no-verify-jwt
```

### Langkah 7 — Database Webhook (pemicu saat order masuk)
Supabase Dashboard → **Database → Webhooks → Create a new hook**:
- **Table:** `orders`
- **Events:** `Insert` + `Update`
- **Type:** Supabase Edge Functions → pilih `notify-order`
- **HTTP Headers:** tambah `x-hook-secret` = nilai `NOTIFY_HOOK_SECRET` (Langkah 5)

Function akan otomatis menyaring: hanya kirim push saat order **paid = true & status = 'baru'** (lihat `decide()` di `notify-order/index.ts`).

### Langkah 8 — Rebuild & install APK
```bash
npm run kasir:sync
# build APK debug:
android/gradlew.bat -p android assembleDebug
```
Login kasir → token FCM otomatis terdaftar (RPC `register_device_token`). Tes: buat order online dari PWA Customer saat app Kasir di-background → notifikasi + suara muncul.

---

## Troubleshooting
- **Tak ada push padahal sudah setup:** cek (a) `google-services.json` ada & gradle plugin diaktifkan, (b) izin notifikasi diberikan, (c) token masuk tabel `device_tokens` (cabang benar), (d) secret `GOOGLE_SERVICE_ACCOUNT`/`NOTIFY_HOOK_SECRET` terisi, (e) webhook header `x-hook-secret` cocok.
- **Build APK gagal setelah Langkah 3:** berarti `google-services.json` belum ada di `android/app/`. Taruh dulu file-nya.
- **Suara kustom tak bunyi:** Android mengikat suara ke *channel*. Bila channel sudah terlanjur dibuat dengan suara lama, uninstall lalu install ulang (channel dibuat ulang).
