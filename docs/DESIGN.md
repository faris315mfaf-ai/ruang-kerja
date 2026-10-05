# Design System — RuangKerja

> Gaya: **minimal profesional ala Linear**, glassmorphism **tipis**, nuansa **hijau-biru (teal)** ala SPKD, mode terang & gelap, Bahasa Indonesia.
> Warna di bawah adalah **perkiraan sementara**. Setelah hex resmi SPKD diterima, cukup ganti nilai `--brand-*` di `resources/css/tokens.css`.

## 1. Prinsip

1. **Konten dulu.** Kerapatan informasi tinggi, dekorasi rendah. Warna brand hanya untuk aksi utama, fokus, dan status penting.
2. **Glass hanya di lapisan mengambang.** Sidebar, topbar, command palette, popover, modal, toast. **Tidak** untuk tabel, form, atau kartu Kanban (kontras turun, melelahkan dibaca berjam-jam).
3. **Satu aksi utama per layar.** Tombol primer (teal) maksimal satu per area.
4. **Keyboard-first.** Setiap aksi utama punya pintasan dan muncul di command palette.
5. **Status selalu punya ikon + teks**, bukan warna saja (aksesibilitas).

## 2. Warna

### Brand (sementara)
| Token | Hex | Pakai untuk |
|---|---|---|
| `--brand-50` | `#ECFBF8` | latar sorotan lembut (terang) |
| `--brand-100` | `#CFF5EE` | |
| `--brand-300` | `#5FD6C4` | |
| `--brand-400` | `#2FC0B0` | primer di mode gelap |
| `--brand-500` | `#14A3A0` | |
| `--brand-600` | `#0A7C85` | **primer** di mode terang |
| `--brand-700` | `#075F69` | hover primer |
| `--accent-blue` | `#2F7BEA` | tautan, info, gradien brand |
| `--accent-green` | `#1FAE6B` | sukses |
| Gradien brand | `linear-gradient(135deg, #14A3A0, #2F7BEA)` | logo, avatar workspace, ilustrasi kecil. **Bukan** untuk tombol |

### Netral & permukaan
| Token | Terang | Gelap |
|---|---|---|
| `--bg` | `#F6F8F9` | `#0A0E11` |
| `--surface` | `#FFFFFF` | `#10161A` |
| `--surface-2` (hover, header tabel) | `#F1F4F6` | `#151C21` |
| `--border` | `#E2E8EB` | `#1F292F` |
| `--border-strong` | `#CBD5DA` | `#2B373E` |
| `--text` | `#0F1A1F` | `#E7EEF1` |
| `--text-muted` | `#5A6A72` | `#8C9CA4` |
| `--text-subtle` | `#8A979E` | `#5F6E76` |
| `--glass-bg` | `rgba(255,255,255,0.72)` | `rgba(16,22,26,0.66)` |
| `--glass-border` | `rgba(15,26,31,0.08)` | `rgba(255,255,255,0.07)` |
| `--glass-blur` | `16px` | `16px` |

Latar `--bg` mode gelap boleh diberi dua cahaya radial sangat tipis (teal kiri atas, biru kanan bawah, opasitas ≤ 8%) agar glassmorphism terasa, tanpa mengganggu keterbacaan.

### Semantik
| Makna | Terang | Gelap | Contoh |
|---|---|---|---|
| Sukses / hadir | `#13804F` | `#3CCB86` | Hadir tepat waktu, task selesai |
| Peringatan / terlambat | `#9A6200` | `#F2B13A` | Terlambat, tenggat hari ini |
| Bahaya / alpha | `#C42B2B` | `#F06A6A` | Alpha, task terlambat, ditolak |
| Info / cuti | `#1F66D1` | `#5C9BFF` | Cuti, izin, dinas |
| Netral / libur | `--text-muted` | | Libur, dibatalkan |

### Prioritas task (ikon batang ala Linear)
`Urgent` kotak merah dengan `!` · `Tinggi` 3 batang · `Sedang` 2 batang · `Rendah` 1 batang · `Tanpa` tiga titik.

### Status task (ikon lingkaran ala Linear)
`Backlog` lingkaran putus-putus · `Todo` lingkaran kosong · `Sedang dikerjakan` lingkaran setengah (kuning) · `Review` lingkaran tiga-perempat (biru) · `Selesai` lingkaran centang (brand) · `Dibatalkan` lingkaran silang (abu).

## 3. Tipografi

- **UI:** `Plus Jakarta Sans` (karya Tokotype, Jakarta; rapi, modern, dan punya karakter lokal). Pakai angka `tnum` di tabel & dashboard.
- **Mono:** `JetBrains Mono` untuk ID task (`KEU-12`), jam, dan kode.
- Skala (px / line-height): 11/16 label kecil · **13/20 teks dasar UI** · 14/20 teks konten · 16/24 judul kartu · 20/28 judul halaman · 28/36 angka KPI.
- Berat: 400 teks, 500 label & tombol, 600 judul. Hindari 700+.
- Huruf kapital hanya untuk label seksi kecil (11px, `letter-spacing: .04em`).

## 4. Ruang, radius, bayangan

- Grid 4 px. Jarak umum: 4, 8, 12, 16, 24, 32.
- Radius: 6 (input, tombol), 8 (kartu, menu), 12 (modal, panel), 999 (avatar, pill).
- Bayangan terang: `0 1px 2px rgba(15,26,31,.06), 0 4px 12px rgba(15,26,31,.04)`. Gelap: tidak ada bayangan, gunakan border + highlight atas `inset 0 1px 0 rgba(255,255,255,.04)`.
- Tinggi kontrol: 28 (kecil), **32 (default)**, 36 (form utama), 44 (tombol check-in di ponsel).

## 5. Tata letak

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ Topbar: breadcrumb · cari (⌘K) · check-in · 🔔 │
│ 240px    ├──────────────────────────────────────────────┤
│ (glass)  │ Konten (maks 1440px, padding 24)              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Shell desktop (keputusan pemilik, 6 Okt 2026):** menu bar glass 38px di atas, konten penuh layar dengan margin 10px, dan **Dock ala macOS** mengambang di bawah. Ikon Dock berbentuk squircle berwarna palet, membesar mengikuti kursor (spring critically damped, bisa diinterupsi), menampilkan label di atas, titik di bawah ikon aktif, dan badge jumlah. Workspace favorit tampil sebagai ikon; semua workspace, menu Organisasi (struktur, kelola organisasi, karyawan) dan menu Admin ada di *stack* — setiap tujuan hanya ada di satu tempat; stack yang isinya satu tampil sebagai ikon biasa. Saat disorot, glyph ikon bergerak dalam loop tanpa sambungan (berhenti dengan `prefers-reduced-motion`). Mockup lama dengan sidebar 240px tetap jadi acuan isi halaman, bukan shell.

**Ponsel (< 768px):** tidak ada sidebar. App bar 56px + tab bawah glass berbentuk *dock kapsul* mengambang (lihat PLATFORM.md §4): Beranda · Absen · Tugas · Inbox · Menu (workspace & admin ada di tab Menu). Tombol check-in besar di halaman Absen. Aturan lengkap, matriks fitur, dan cara implementasi: **`docs/PLATFORM.md`**.

## 6. Komponen utama

| Komponen | Catatan |
|---|---|
| **Button** | `primary` (teal solid), `secondary` (surface + border), `ghost`, `danger`. Ikon 16px, gap 6 |
| **Input / Select / Combobox** | Border 1px, fokus ring 2px `--brand-500` 40% |
| **Kartu Kanban** | Surface solid, border, radius 8, padding 10–12. Baris 1: ID mono + ikon prioritas. Baris 2: judul (maks 2 baris). Baris 3: label pill, tenggat (merah bila lewat), avatar penanggung jawab |
| **Kolom Kanban** | Header: ikon status + nama + jumlah + tombol `+`. Lebar 300px |
| **TaskSheet** | Panel samping kanan (640px) atau halaman penuh. Kiri: judul, deskripsi Tiptap, sub-task, aktivitas & komentar. Kanan: properti (status, prioritas, penanggung jawab, tenggat, label, workspace, lampiran Drive) |
| **StatCard** | Label kecil, angka 28px `tnum`, delta vs periode lalu (hijau/merah + panah), sparkline opsional |
| **Kartu Check-in** | Status hari ini, jam masuk/pulang terjadwal, jam sekarang besar (mono), tombol primer 44px, metode (GPS/QR) sebagai segmented control |
| **Badge status absensi** | Titik warna + teks: "Hadir", "Terlambat 12m", "Cuti", "Alpha" |
| **Command palette** | Glass, lebar 640px, grup: Aksi · Tugas · Orang · Workspace · Dokumen |
| **Toast** | Glass, pojok kanan bawah, otomatis hilang 4 detik, ada aksi "Urungkan" untuk pindah/hapus task |
| **Empty state** | Ikon garis 32px + satu kalimat + satu tombol aksi |

Ikon: **Lucide**, stroke 1.75, ukuran 16 (UI) / 20 (navigasi).

## 7. Gerak

- Durasi 120 ms (hover, toggle), 180 ms (popover, sheet), easing `cubic-bezier(.2,.8,.2,1)`.
- Drag Kanban: kartu terangkat (scale 1.02, bayangan), placeholder garis putus-putus.
- Hormati `prefers-reduced-motion`.
- Ikon beranimasi / loop ambient: gerak halus berulang tanpa sambungan (frame awal = frame akhir), hanya `transform`/`opacity`, dan berhenti di frame diam saat `prefers-reduced-motion`. Pakai seperlunya — status hidup (sinkron, check-in berhasil, menunggu), bukan dekorasi.
- Panduan kerja dengan agent (skill `animate`, `review-animations`, `motion-design`, `apple-hig`): lihat CLAUDE.md.

## 8. Bahasa & tulisan UI

- Bahasa Indonesia baku tapi ringkas dan ramah: "Check-in berhasil", "Tugas saya", "Ajukan cuti", "Tenggat", "Penanggung jawab".
- Istilah yang dipakai konsisten: *Tugas* (task), *Workspace*, *Pengajuan*, *Persetujuan*, *Tenggat*, *Check-in/Check-out*.
- Tanggal: `Sab, 3 Okt 2026`. Jam: `08.05` (format Indonesia, titik). Relatif: "2 jam lalu", "besok".
- Angka: `1.250` (titik ribuan), persen `92%`.
- Pesan galat menyebut solusi: "Anda berada 340 m dari Kantor Pusat (batas 100 m). Ajukan dinas luar jika sedang bertugas di luar."

## 9. Aksesibilitas

- Kontras teks ≥ 4.5:1 di kedua mode. Sudah dicek untuk `--text`, `--text-muted`, `--primary`, dan warna semantik di atas. Cek ulang bila warna brand diganti.
- `--text-subtle` (≈3:1) hanya untuk placeholder, ikon dekoratif, dan elemen nonaktif, **bukan** teks yang harus dibaca.
- `--accent-blue` dan `--accent-green` untuk gradien, ikon, dan titik status. Teks berwarna memakai token semantik (`--info`, `--success`).
- Fokus selalu terlihat. Seluruh aplikasi dapat dipakai dengan keyboard (termasuk pindah kartu: `Shift+→`).
- Target sentuh ≥ 44px di ponsel.
