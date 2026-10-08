# Sesi glm

**Terakhir diperbarui:** 8 Okt 2026 (sesi 4, sore) · ZCode (GLM)

## Tugas berjalan
Fitur **absensi → grup WhatsApp manajemen** (Evolution API; keputusan pemilik 8 Okt 2026 membuka hold WhatsApp): rencana kerja wajib sebelum check-in + salinan otomatis ke grup. Kode selesai di worktree ini; verifikasi penuh berjalan; **belum push** — menunggu perintah pemilik.

## Worktree / branch
`/Users/godam/PROYEK/ruang-kerja-glm` · `glm/absensi-whatsapp` · https://ruangkerja-glm.test

## Rancangan yang disetujui pemilik (8 Okt)
1. Karyawan mengisi **rencana kerja hari ini** (wajib) sebelum absen.
2. Setelah check-in sukses → pesan otomatis ke **grup WhatsApp manajemen**: nama, jam WIB, status, rencana kerja.
3. Gateway: **Evolution API** self-hosted (riset 8 Okt: Cloud API resmi maks 8 peserta/grup → tidak layak; risiko ToS WhatsApp disadari pemilik — nomor gateway khusus).

## Implementasi
- Migrasi `2026_10_15_100000` → `attendance_days.work_plan` (rollback teruji); `CheckInData`/`CheckInRequest` `work_plan` nullable maks 2.000 (API opsional untuk QR/kiosk & API ponsel mendatang); `CheckIn` menyimpan trim + dispatch job hanya bila kanal nyala + grup terisi.
- `EvolutionWhatsApp` service (REST `POST /message/sendText/{instance}`, header `apikey`, delay 800 ms) + `SendCheckInWhatsApp` job (5 percobaan, backoff 60–1800 dtk, `failed()` = log warning; kegagalan tidak pernah mengganggu absensi).
- UI: textarea wajib "Rencana kerja hari ini" di `flow/selfie-review.tsx` (dipakai shell ponsel & desktop); helper murni `planRejection` + Vitest.
- Presenter `day()` mengekspos `workPlan`; `phpunit.xml` mengosongkan env WhatsApp (isolasi test); `.env.example` + `.env.production.example`; kontainer `evolution` profil `whatsapp` di `compose.yml` (dev, port 8082) & `compose.prod.yml` (internal, tanpa port publik; pairing lewat tunnel SSH).
- Dokumen: `docs/fitur/absensi-whatsapp.md`, `docs/deploy/WHATSAPP.md`, `docs/DATABASE.md` §2.

## Test
Pest baru `CheckInWorkPlanTest` (4) + `CheckInWhatsAppTest` (6: dispatch saat nyala/mati, payload Evolution benar, no-op tanpa grup, 500 → lempar untuk retry, check-out tak mengirim). Vitest `planRejection` (2). Suite Attendance+Notifications **442 lulus**; typecheck/lint bersih.

## Langkah berikutnya
1. Verifikasi penuh (composer test/lint, npm test, build) — sedang berjalan; commit berurutan setelah hijau.
2. Lapor pemilik → minta izin push + PR → deploy (ikuti `docs/deploy/WHATSAPP.md` §1–4; pairing QR & rahasia oleh pemilik).
3. Menyusul bila diminta: UI Pengaturan HR (cek koneksi, pilih grup dari daftar, uji kirim), grup per divisi, kanal personal (F2-4).

## Keputusan pengguna yang berlaku
- 8 Okt: pakai Evolution API; alur rencana kerja → absen → grup manajemen.
- Push/PR/deploy tetap menunggu perintah eksplisit per tindakan.

## Butuh dari pemilik / agen lain
- Nomor gateway khusus + `EVOLUTION_API_KEY` ≥32 karakter + `WHATSAPP_GROUP_JID` (setelah pairing; langkah di `docs/deploy/WHATSAPP.md`).
- CHANGELOG diisi integrator saat merge.

## Verifikasi terakhir
Terarget hijau (§Test). Verifikasi penuh berjalan saat catatan ini ditulis.

## Riwayat singkat (sesi 1–3)
Sesi 3: rencana aplikasi ponsel `docs/fitur/aplikasi-ponsel-rencana.md` (commit lokal `main` `dcb8a3a`, belum push). Sesi 2: PR #12 merge `2d724e1`, deploy spkd.store `4ae50a2245fb`, §6.E bersih-bersih, Pest 3.220/Vitest 779 hijau. Sesi 1: U-06 dynamic import Hocuspocus/Yjs.
