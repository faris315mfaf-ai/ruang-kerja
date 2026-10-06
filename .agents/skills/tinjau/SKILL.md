---
name: tinjau
description: Tinjau perubahan branch saat ini terhadap main berdasarkan AGENTS.md dan docs/ (keamanan, otorisasi, logika waktu, kesesuaian PRD/DB, test, UI desktop & mobile). Hanya melapor, tidak mengubah kode.
argument-hint: [opsional: base branch, default main]
disable-model-invocation: true
---

# Tinjau perubahan

Base: `$ARGUMENTS` (argumen dari pengguna; bila kosong pakai `main`). Lihat `git diff <base>...HEAD` dan `git log <base>..HEAD --oneline`.

Periksa dan laporkan per kategori, urut dari paling berat:
1. **Keamanan & otorisasi:** endpoint/channel tanpa Policy, kebocoran data lintas divisi/workspace/proyek, data sensitif (token, selfie, NIK) di log atau respons. Lihat juga invariant di `docs/CRITICAL.md` §1.
2. **Kebenaran logika:** zona waktu (UTC simpan, Asia/Jakarta tampil), batas tanggal kerja & shift lintas tengah malam, race condition penomoran, transaksi, idempotensi job & scheduler, lazy loading (mode strict aktif di luar produksi).
3. **Kesesuaian dokumen:** nama tabel/kolom sesuai `docs/DATABASE.md`, aturan bisnis sesuai `docs/PRD.md`, tidak membangun fitur di luar fase kecuali diminta.
4. **Test:** alur kritis tanpa test (check-in, close-day, approval, pindah tugas, sinkron Drive, rumus metrik & progres proyek).
5. **UI:** teks non-Indonesia, warna hard-coded (bukan token), tidak ada versi mobile atau versi mobile = desktop terpotong, state kosong/memuat/galat, mode malam, aksesibilitas (label, fokus, target sentuh).
6. **Kinerja:** N+1, query tanpa indeks, payload Inertia berlebihan.

Untuk setiap temuan: `file:baris` · masalah · skenario gagal konkret · saran perbaikan. Jangan mengubah kode. Jangan melaporkan gaya yang sudah ditangani Pint/oxfmt. Tutup dengan verdict: **Siap merge** / **Perlu perbaikan** (sebut yang wajib).
