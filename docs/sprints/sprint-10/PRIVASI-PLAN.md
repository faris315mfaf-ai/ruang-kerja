# Sprint 10 — Bagian B (privasi, kinerja, integrasi) · Rencana

Cabang `feat/sprint-10-privasi`. Acuan: PROMPTS Sprint 10 tugas 2 & 3, PRD §8 (UU PDP), ARCHITECTURE §5, sisa/risiko di ringkasan sprint sebelumnya, pesan lead (g, h).

## 1. Privasi — "Data Saya"
- Modul baru `app/Domain/Privacy` (tanpa tabel): `Services/MyData` (profil, persetujuan, absensi, pengajuan, keputusan — selalu berdasarkan id pengguna yang login), `Services/PrivacyPolicy` (Markdown + versi), `Exports/MyDataSections`, `Actions/ExportMyData` (Excel multi-sheet + PDF, diaudit).
- Gate `viewOwnData` (`PrivacyServiceProvider`): karyawan aktif.
- Rute `routes/privacy.php`: `GET /privasi`, `GET /privasi/ekspor/{xlsx|pdf}` (throttle 10/menit), `GET /kebijakan-privasi` (publik, ditaut dari login). Cabut/beri persetujuan memakai rute absensi yang sudah ada.
- `RevokeAttendanceConsent` mengirim `ConsentRevokedNotification` (type baru `attendance.consent_revoked`) ke HR perusahaan.
- Kebijakan: `config/privacy.php` + `resources/markdown/privacy-policy.md`; versi persetujuan absensi mengikuti `PRIVACY_POLICY_VERSION`.
- UI: `pages/privacy/{index,policy}.tsx`, `features/privacy/*` — satu tata letak responsif (kolom samping di kanan pada desktop, di atas pada ponsel).

## 2. Kinerja
- Uji regresi jumlah query semua halaman utama (`tests/Feature/Performance`, data demo dilipatgandakan dua kali → jumlah query tidak boleh naik).
- Audit indeks (FK & pola query) → migrasi indeks yang kurang.
- Lighthouse Absensi ponsel: ukur sebelum/sesudah, pecah kode berat dari jalur Absensi.

## 3. Integrasi
a. once-prop `attendanceStatus` per user · b. Tandai ditinjau & Koreksi di Dashboard HR · c. ringkasan harian tanpa duplikat persetujuan · d. provider ⌘K Pengajuan · e. widget Direksi berbasis jadwal · f. bentrok unik → galat validasi · g. koreksi HR di hari setengah-cuti/dinas · h. dashboard menghitung setengah-cuti/dinas yang check-in sebagai hadir.

## Risiko
- Anggaran jumlah query bisa naik sah saat modul lain menambah fitur → naikkan anggaran di commit yang sama (pesan galat menunjukkan angkanya).
- Lighthouse lokal dipengaruhi beban mesin; angka dilaporkan sebagai rentang beberapa kali jalan.
