# Pemisahan Tampilan Desktop & Mobile — RuangKerja

> Wajib dibaca sebelum membangun halaman apa pun. Setiap halaman Fase 1 punya **dua tata letak**: desktop dan mobile. Mockup acuan ada di canvas "RuangKerja — Mockup UI" (halaman berawalan **Desktop ·** dan **Mobile ·**).

## 1. Keputusan

| Hal | Keputusan |
|---|---|
| Satu aplikasi atau dua? | **Satu aplikasi web** (Laravel + Inertia + React), dua *layout shell*: `DesktopLayout` dan `MobileLayout`. Dipasang sebagai **PWA** di ponsel. |
| Aplikasi native | Fase 3 (React Native/Expo) memakai **desain mobile yang sama** dan API yang sama. Mockup mobile = spesifikasi aplikasi native. |
| Cara memilih layout | Berdasarkan **lebar layar** (bukan user-agent). Server tidak perlu tahu perangkatnya. |
| Breakpoint | `< 768px` = mobile · `768–1023px` = tablet (memakai layout desktop dengan rail ringkas 56px) · `≥ 1024px` = desktop (sidebar penuh 240px, bisa diciutkan) |
| Data & logika | **Sama persis.** Controller, Action, Policy, props Inertia tidak dibedakan. Hanya komponen tampilan yang berbeda. |

## 2. Shell per platform

| Elemen | Desktop (≥ 1024) | Tablet (768–1023) | Mobile (< 768) |
|---|---|---|---|
| Navigasi utama | **Dock ala macOS** mengambang di bawah (ikon membesar mengikuti kursor dengan spring, stack Organisasi, Workspace & Admin) | Dock yang sama tanpa magnifikasi | **Tab bawah 5 item** sebagai *dock kapsul* mengambang: Beranda · Absen · Tugas · Inbox · Menu |
| Workspace & admin | Di sidebar | Di rail | Di tab **Menu** |
| Topbar | **Menu bar tipis 38px**: merek, breadcrumb, status absensi, check-in, cari ⌘K, lonceng, akun. Konten penuh layar, margin 10px | Sama | **App bar 56px**: judul + aksi (cari, lonceng) / tombol kembali di layar turunan |
| Cari | Command palette (modal glass) | Sama | Layar cari penuh |
| Panel detail | Panel samping kanan (TaskSheet 640px, detail pengajuan) | Panel samping atau layar penuh | **Layar penuh baru** atau **bottom sheet** |
| Tabel | Tabel penuh (TanStack Table) | Tabel dengan kolom diciutkan | **Daftar kartu / baris 56px** |
| Aksi utama | Tombol di header | Sama | **FAB 56px** atau **bilah aksi bawah** |
| Aksi baris | Hover + menu | Menu | **Geser kartu** (swipe) + menu "more" |
| Board Kanban | Semua kolom berdampingan, drag & drop | Scroll horizontal | **Satu kolom per layar**, tab kolom geser; pindah status lewat menu "Pindahkan" (tanpa drag) |
| Kalender | Grid bulan | Grid bulan | **Strip minggu + agenda** |
| Dashboard | Grid multi-kolom | 2 kolom | 1 kolom, KPI 2×2, grafik disederhanakan |

## 3. Matriks fitur per platform

✓ = penuh · ◐ = terbatas (lihat/cari, ubah di desktop) · — = tidak tersedia

| Modul / fitur | Desktop | Mobile | Catatan mobile |
|---|---|---|---|
| Login Google | ✓ | ✓ | |
| Beranda / Dashboard Saya | ✓ | ✓ | Kartu check-in di atas |
| Check-in/out GPS + selfie | ✓ | ✓ | **Prioritas ponsel**. Kamera depan, akurasi tinggi |
| Pindai QR kiosk | ✓ | ✓ | |
| Halaman kiosk QR | ✓ (tablet/TV) | — | Perangkat khusus di lobi |
| Riwayat absensi saya | ✓ | ✓ | Kalender bulan kecil + daftar |
| Pengajuan (buat, lihat, batalkan) | ✓ | ✓ | Lampiran bisa langsung dari kamera |
| Persetujuan (setuju/tolak/revisi) | ✓ | ✓ | Geser kartu untuk keputusan cepat. Aksi massal hanya desktop |
| Tugas saya, detail tugas, komentar | ✓ | ✓ | Kotak komentar menempel di bawah |
| Buat tugas | ✓ | ✓ | Bottom sheet cepat |
| Board / List / Kalender | ✓ | ✓ | Board satu kolom, kalender agenda |
| File & dokumen Drive | ✓ | ✓ | Buka di aplikasi Google, unggah dari kamera/galeri |
| Inbox & notifikasi | ✓ | ✓ | Geser untuk arsip/dibaca |
| Cari | ✓ | ✓ | Layar penuh |
| Dashboard Kadiv / HR | ✓ | ✓ | Versi ringkas 1 kolom |
| Portofolio & detail proyek (Direksi) | ✓ | ✓ | Tabel proyek → kartu proyek; roadmap hanya desktop (mobile: milestone berikutnya per kartu); "Minta update" & "Beri arahan" di bilah aksi bawah |
| Pengaturan notifikasi & tema | ✓ | ✓ | Matriks → daftar accordion |
| Admin karyawan | ✓ | ◐ | Cari & lihat profil. Tambah/ubah/impor di desktop |
| Struktur organisasi | ✓ | ◐ | Daftar bertingkat, bukan bagan |
| Alur persetujuan, jenis cuti | ✓ | — | Banner "Buka di desktop" bila diakses |
| Lokasi, shift, hari libur | ✓ | — | Sama |
| Pengaturan workspace lanjutan | ✓ | ◐ | Anggota bisa dilihat. Kolom status & label di desktop |
| Rekap & ekspor bulanan | ✓ | ◐ | Ringkasan saja. Ekspor Excel/PDF di desktop |
| Audit log, impor CSV | ✓ | — | |

Fitur ◐ dan — di mobile tetap punya rute. Rute itu menampilkan versi baca-saja atau banner: *"Fitur ini tersedia di desktop."* + tombol "Kirim tautan ke email saya". **Jangan** menampilkan tata letak desktop yang terpotong di ponsel.

## 4. Aturan sentuh & tipografi mobile

- Target sentuh ≥ 44×44 px. Baris daftar ≥ 56 px. Tombol utama 48–52 px.
- **Input `font-size: 16px`** (mencegah zoom otomatis iOS). Tinggi input 44–48 px.
- Padding samping 16 px. Teks dasar 14 px, judul app bar 17 px.
- Hormati *safe area* (`env(safe-area-inset-*)`) untuk tab bawah dan bilah aksi.
- Tab bawah = **dock kapsul**: glass, `rounded-full`, jarak 10px dari tepi kiri/kanan, melayang 10px di atas safe area, lebar maks 420px di tengah, bayangan `--dock-shadow`. Tab aktif ditandai pil yang bergeser (transform 180ms `ease-brand`, instan dengan `prefers-reduced-motion`), ikon mengecil saat ditekan. Semua elemen yang menempel di atas tab bar (padding konten, FAB, bilah aksi, toast) memakai `--tab-bar-height` (= ruang yang dipakai kapsul di atas safe area), jangan angka tetap.
- Keyboard: saat input fokus, bilah aksi bawah ikut naik (pakai `visualViewport`), tab bawah disembunyikan.
- Glass hanya untuk app bar (saat menggulir), tab bawah, bottom sheet, toast.
- Tidak ada interaksi yang hanya mengandalkan hover. Pintasan keyboard hanya desktop.

## 5. Implementasi (Inertia + React)

```
resources/js/
├── layouts/
│   ├── AppLayout.tsx          # memilih shell sesuai breakpoint
│   ├── DesktopLayout.tsx      # sidebar / rail + topbar
│   └── MobileLayout.tsx       # app bar + tab bawah, props: title, back, actions, bottomBar
├── hooks/useBreakpoint.ts     # 'mobile' | 'tablet' | 'desktop' (matchMedia, SSR-safe)
├── pages/tasks/Show.tsx       # satu halaman Inertia...
└── features/tasks/
    ├── TaskDetail.desktop.tsx # ...dua tampilan bila tata letaknya berbeda jauh
    ├── TaskDetail.mobile.tsx
    └── TaskProperties.tsx     # komponen bersama (dipakai keduanya)
```

Aturan:
1. **Satu halaman Inertia per rute.** Halaman memilih `*.desktop.tsx` atau `*.mobile.tsx` lewat `useBreakpoint()`. Untuk halaman yang hanya beda kecil, cukup satu komponen dengan kelas responsif Tailwind (`md:`, `lg:`).
2. Logika data (form, mutasi, optimistic update) ada di **hook bersama** (`useTaskForm`, `useApproval`), bukan di komponen tampilan, supaya kedua versi tidak menyimpang.
3. Komponen primitif (Button, Input, Badge, StatusIcon, PriorityIcon, Avatar) **sama** di kedua platform. Hanya ukuran yang berubah lewat varian `size`.
4. Komponen khusus mobile di `components/mobile/`: `BottomSheet` (Vaul / Radix Dialog), `SwipeableRow`, `Fab`, `TabBar`, `AppBar`, `ChipScroller`, `WeekStrip`.
5. Hindari *hydration mismatch*: render awal SSR memakai shell netral (skeleton). Breakpoint ditentukan di klien. Atau set cookie `viewport=mobile` dari klien untuk render berikutnya.
6. **PWA:** manifest (nama, ikon, `display: standalone`, `theme_color` teal), service worker hanya untuk shell & aset statis (data selalu dari jaringan). Halaman offline sederhana: "Anda sedang offline. Check-in butuh koneksi."
7. **Uji:** setiap halaman diuji di 3 lebar (375, 834, 1440) memakai Playwright (snapshot visual). Dark & light masing-masing.

## 6. Pemetaan layar mockup

| Fitur | Desktop (canvas) | Mobile (canvas) |
|---|---|---|
| Login | Login | MLogin |
| Beranda / dashboard pribadi | DashboardSaya | MBeranda |
| Menu & workspace | Sidebar (Main) | MMenu |
| Cari | CommandPalette | MCari |
| Inbox | Inbox | MInbox |
| Pengaturan notifikasi | PengaturanNotifikasi | MPengaturanNotifikasi |
| Check-in | — (tombol di topbar) | Absensi, CheckinConsent, CheckinSelfie, CheckinSukses, CheckinGagal |
| Riwayat absensi | RekapAbsensi (panel kalender) | MRiwayatAbsensi |
| Ajukan pengajuan | FormPengajuan | MFormPengajuan |
| Pengajuan saya | PengajuanSaya | MPengajuanSaya |
| Persetujuan | Persetujuan | MPersetujuan, MPersetujuanDetail |
| Tugas saya | TugasSaya | MTugasSaya |
| Board | Kanban | MBoard |
| Detail tugas | TaskDetail | MTaskDetail |
| Buat tugas | (dialog) | MTugasBaru |
| Kalender | KalenderTugas | MKalender |
| File & dokumen | WorkspaceFile | MFile |
| Dashboard Kadiv | Main | MDashboardKadiv |
| Dashboard HR | DashboardHR | MDashboardHR |
| Dashboard Direksi (portofolio proyek) | DashboardDireksi | MDashboardDireksi |
| Detail proyek | ProyekDetail | MProyekDetail |
| Admin karyawan | Karyawan | MKaryawan (terbatas) |
| Struktur org, alur, lokasi/shift, pengaturan workspace, kiosk | ada | desktop saja / terbatas |
