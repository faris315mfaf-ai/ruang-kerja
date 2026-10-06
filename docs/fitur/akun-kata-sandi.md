# Akun & kata sandi

> **Status:** **Nyata** (keputusan pemilik 6 Okt 2026, branch `claude/akun-sandi`). Tanpa flag fitur: berlaku di semua lingkungan.

## Keputusan pemilik

- Semua karyawan aktif **login dengan email kantor + kata sandi**. Login Google **ditahan**: rute `auth.google.*` dan kodenya tetap ada, tombolnya tidak ditampilkan.
- Super Admin tetap **wajib 2FA (TOTP)**; peran lain tanpa 2FA.
- HR bisa **mengatur kata sandi** karyawan.
- **Lupa kata sandi** butuh **persetujuan HR**; setelah disetujui, halaman karyawan yang menunggu otomatis pindah ke form kata sandi baru.

## Cara pakai

| Siapa | Di mana | Apa |
|---|---|---|
| Semua karyawan | `/login` | Email kantor + kata sandi, "Ingat saya". Pesan galat selalu sama: *Email atau kata sandi salah. Belum punya kata sandi? Hubungi HR atau pakai Lupa kata sandi.* |
| Semua karyawan | Pengaturan › Keamanan (`/settings/security`, juga Menu › "Kata sandi & keamanan") | Ganti kata sandi sendiri (sandi lama wajib; akun tanpa sandi cukup sandi baru). Minimal 8 karakter, bukan alamat email, berbeda dari sandi lama. Perangkat lain langsung keluar. Super Admin juga mengatur TOTP di sini. |
| HR & Super Admin | Admin › Karyawan › profil › **Atur kata sandi** (desktop) | "Buat sandi sementara" (12 karakter, ditampilkan sekali + tombol salin) atau "Ketik kata sandi". Opsi **Wajib ganti saat login berikutnya** (bawaan aktif). Semua sesi karyawan keluar; karyawan mendapat notifikasi in-app + email tanpa isi sandi. Sandi Super Admin hanya oleh Super Admin; tidak untuk diri sendiri. |
| Karyawan | `/lupa-sandi` | Isi email → halaman tunggu `/lupa-sandi/menunggu` (diperiksa otomatis tiap 5 detik, berhenti saat tab tersembunyi). Teks sama persis untuk email yang tidak terdaftar. |
| HR & Super Admin | Admin › Karyawan (panel **Permintaan reset sandi** + badge) dan profil karyawan; notifikasi "Perlu tindakan" + email | **Setujui** atau **Tolak** (alasan wajib, tampil di layar karyawan). Konfirmasi dulu ke karyawan (mis. telepon). Permintaan Super Admin hanya diputus Super Admin lain. Bisa di ponsel. |
| Karyawan | `/lupa-sandi/sandi-baru` | Muncul otomatis setelah disetujui, hanya di peramban yang meminta, berlaku 30 menit. Simpan → perangkat lain keluar, langsung masuk ke Dashboard (Super Admin ber-TOTP diarahkan ke login agar kode tetap diminta). |

Batas waktu: permintaan 24 jam; setelah disetujui 30 menit. Satu permintaan aktif per karyawan (permintaan baru menggantikan yang lama). Job `ExpirePasswordResetRequests` (tiap jam) membersihkan yang kedaluwarsa dan menghapus riwayat > 90 hari.

## Mencoba di lokal

1. `hr@demo.test` / `password` (atau tombol demo). Karyawan seeder selain akun demo belum punya sandi, mis. `bayu.saputra@demo.test`.
2. Peramban lain (jendela pribadi): `/lupa-sandi` → `bayu.saputra@demo.test` → biarkan halaman tunggu terbuka.
3. Sebagai HR: Admin › Karyawan → **Setujui**. Peramban karyawan pindah sendiri ke form sandi baru.
4. Sebagai HR: profil Bayu → **Atur kata sandi** → Buat sandi sementara → masuk sebagai Bayu dengan sandi itu → diarahkan ke Keamanan sampai sandi diganti.

## Data & keamanan

- Tabel `password_reset_requests`, kolom `users.password_change_required` (lihat `docs/DATABASE.md` §1).
- Notifikasi: `account.password_reset_requested` (HR, perlu tindakan) dan `account.password_set_by_hr` (karyawan); baris pengaturan `account.security`, in-app + email terkunci.
- Audit: `user.login_failed`, `user.password_changed`, `user.password_set_by_hr`, `user.password_reset_approved`, `user.password_reset_rejected`, `user.password_reset_completed` — tidak pernah berisi nilai sandi.
- Rate limit dan alur lengkap: `docs/ARCHITECTURE.md` §5, `docs/security/ASVS-L1.md` (V2).

## Ditahan / belum

- Login Google (tombol disembunyikan; kode, rute, dan pengaturan "Akun Google" tetap ada).
- Tidak ada tautan reset lewat email (sengaja: reset selalu lewat HR).
- "Atur kata sandi" hanya desktop (matriks PLATFORM: ubah data karyawan di desktop); memutus permintaan reset bisa di ponsel.
