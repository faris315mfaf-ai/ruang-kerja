# Pemisahan Tampilan Desktop & Mobile — RuangKerja

> Wajib dibaca sebelum membangun halaman apa pun. Setiap halaman Fase 1 punya **dua tata letak**: desktop dan mobile. Mockup acuan ada di canvas "RuangKerja — Mockup UI" (halaman berawalan **Desktop ·** dan **Mobile ·**).
>
> **Mobile-first (6 Okt 2026):** tampilan ponsel mengikuti canvas **"RuangKerja · Mockup Mobile-first"** (43 layar, https://claude.ai/artifact/WWiCQBjLHrsdNPUo79dxjX; privat, minta akses ke pemilik). Bila berbeda dengan mockup mobile lama (`docs/mockups/png/mobile/`), canvas mobile-first yang berlaku. Keputusannya dirangkum di §2.1.

## 1. Keputusan

| Hal | Keputusan |
|---|---|
| Satu aplikasi atau dua? | **Satu aplikasi web** (Laravel + Inertia + React), dua *layout shell*: `DesktopLayout` dan `MobileLayout`. Dipasang sebagai **PWA** di ponsel. |
| Aplikasi native | Fase 3 (React Native/Expo) memakai **desain mobile yang sama** dan API yang sama. Mockup mobile = spesifikasi aplikasi native. |
| Cara memilih layout | Berdasarkan **lebar layar** (bukan user-agent). Server tidak perlu tahu perangkatnya. |
| Breakpoint | `< 768px` = mobile · `768–1023px` = tablet (`DesktopLayout` dengan **Rail** 96px, Rail.dc.html) · `≥ 1024px` = desktop (MenuBar 64px + Dock) |
| Data & logika | **Sama persis.** Controller, Action, Policy, props Inertia tidak dibedakan. Hanya komponen tampilan yang berbeda. |

## 2. Shell per platform

| Elemen | Desktop (≥ 1024) | Tablet (768–1023) | Mobile (< 768) |
|---|---|---|---|
| Navigasi utama | **Dock ala macOS** mengambang di bawah (ubin 52px membesar mengikuti kursor dengan pegas, stack Workspace, Organisasi & Admin) | **Rail** kaca 96px di kiri: merek, Cari, tujuan yang sama dengan Dock, stack membuka ke kanan, avatar = menu akun | **Tab bawah 5 item** sebagai kapsul mengambang 70px: Beranda · Tugas · **Absen** (tombol bulat di tengah) · Obrolan · Lainnya. Bila Obrolan mati (`FEATURE_CHAT=false`), slot ke-4 = Inbox |
| Workspace & admin | Stack di Dock | Stack di Rail | Di tab **Lainnya** (`/menu`) |
| Topbar | **Menu bar kaca 64px** (MenuBar.dc.html): merek, breadcrumb, chip status absensi + pil Check-in, cari ⌘K/Ctrl K, lonceng berangka, avatar. Konten di kolom 1280px (lebar 1480px untuk board/tabel) padding 40px | Tidak ada (Rail memuat cari & akun); padding konten 24px | **Judul besar 32/40** + tombol bulat 48px (cari, lonceng berbadge = **pintu Inbox**); Beranda: tanggal + sapaan + cari + lonceng (profil lewat Lainnya); layar turunan: bar 56px lengket + tombol kembali bulat |
| Cari | Command palette (modal kaca) | Sama (tombol Cari di Rail, ⌘K) | Layar cari penuh, **kolom cari di bawah** (zona jempol) |
| Panel detail | Panel samping kanan (TaskSheet 640px, detail pengajuan) | Panel samping atau layar penuh | **Layar penuh baru** atau **bottom sheet** |
| Tabel | Tabel penuh (TanStack Table) | Tabel dengan kolom diciutkan | **Daftar kartu / baris 56px** |
| Aksi utama | Tombol di header | Sama | **FAB 60px** (gradien, radius 20) atau **bilah aksi bawah** |
| Aksi baris | Hover + menu | Menu | **Geser kartu** (swipe) + menu "more" |
| Board Kanban | Semua kolom berdampingan, drag & drop | Scroll horizontal | **Satu kolom per layar**, tab kolom geser; pindah status lewat menu "Pindahkan" (tanpa drag) |
| Kalender | Grid bulan | Grid bulan | **Strip minggu + agenda** |
| Dashboard | Grid multi-kolom | 2 kolom | 1 kolom, KPI 2×2, grafik disederhanakan |

### 2.1 Keputusan mobile-first (disetujui 6 Okt 2026)

Ponsel dirancang untuk dipakai satu tangan: aksi yang sering ada di zona jempol (sepertiga bawah layar), bacaan di atas.

| # | Keputusan | Berlaku di |
|---|---|---|
| 1 | Tab bawah: Beranda · Tugas · **Absen** · Obrolan · Lainnya. Absen = tombol bulat gradien 54px yang menonjol di tengah kapsul (aksi harian terpenting). Inbox pindah ke **lonceng berbadge di app bar** setiap layar akar tab, dan tetap ada di Lainnya. Tanpa Obrolan, slot ke-4 kembali Inbox | Shell (`TabBar`, `AppBar`) |
| 2 | Layar Cari: kolom cari menempel di bawah layar, hasil di atasnya | `/cari` |
| 3 | Persetujuan: **tumpukan kartu** (geser kanan = setujui, kiri = tolak) dengan tombol Tolak · Minta revisi · Setujui di zona jempol; detail lewat tautan kartu | `/persetujuan` |
| 4 | Check-in: **geser untuk check-in** (bukan sekali ketuk) supaya tidak absen tanpa sengaja; pilihan metode (GPS + selfie · QR · WFH) sebagai segmented di atas peta | `/absensi` |
| 5 | Antrean absen **offline** hanya untuk aplikasi native Fase 3. PWA tetap menolak check-in tanpa koneksi (§5 butir 6) | Fase 3 |

Butir 2–4 diterapkan modul masing-masing; shell (butir 1) sudah berlaku.

## 3. Matriks fitur per platform

✓ = penuh · ◐ = terbatas (lihat/cari, ubah di desktop) · — = tidak tersedia

| Modul / fitur | Desktop | Mobile | Catatan mobile |
|---|---|---|---|
| Login email + kata sandi (keputusan pemilik 6 Okt 2026; login Google ditahan) | ✓ | ✓ | Form di zona jempol; "Lupa kata sandi" → halaman tunggu persetujuan HR |
| Ganti kata sandi sendiri (Pengaturan › Keamanan) | ✓ | ✓ | Juga di tab Menu › "Kata sandi & keamanan" |
| Beranda / Dashboard Saya | ✓ | ✓ | Kartu check-in di atas |
| Check-in/out GPS + selfie | ✓ | ✓ | **Prioritas ponsel**, tab tengah. Geser untuk check-in, kamera depan, akurasi tinggi |
| Pindai QR kiosk | ✓ | ✓ | |
| Halaman kiosk QR | ✓ (tablet/TV) | — | Perangkat khusus di lobi |
| Riwayat absensi saya | ✓ | ✓ | Kalender bulan kecil + daftar |
| Pengajuan (buat, lihat, batalkan) | ✓ | ✓ | Lampiran bisa langsung dari kamera. Jenis terkunci (cuti & lembur, keputusan pemilik 6 Okt 2026) tidak jadi chip: tampil sebagai daftar bergembok di bawah chip; desktop: ubin bergembok. Pengajuan barang penuh di kedua platform |
| Laporan progres harian (`/laporan`, `/laporan/hari-ini`) | ✓ | ✓ | Keputusan pemilik 6 Okt 2026. Form satu kolom, tombol Kirim di bilah kaca di atas tab bar; kartu "Laporan hari ini" di Beranda |
| Pengumuman (`/pengumuman`) | ✓ | ✓ | Buat lewat FAB + bottom sheet (desktop: dialog). Spanduk di atas dashboard di kedua platform |
| Catatan & notulensi (`/catatan`, keputusan pemilik 6 Okt 2026) | ✓ | ✓ | "Mulai notulensi" 52px di dashboard (desktop: tombol di header + menu "Notulensi terakhir"). Tab dokumen: desktop panel kiri ≥ 1024 (tablet bisa diciutkan), ponsel strip chip di bawah app bar + bottom sheet "Tab dokumen" (sub-tab). Warna teks & stabilo di toolbar; ukuran huruf A−/A+ (90–160%, per perangkat) di toolbar desktop, ponsel lewat lembar "Tampilan teks". Mode catat: pil "Kembali ke notulensi" di semua halaman (desktop di atas Dock, tablet kanan bawah, ponsel di atas tab bar), keluar hanya lewat "Selesai mencatat" |
| Persetujuan (setuju/tolak/revisi) | ✓ | ✓ | Tumpukan kartu + tombol di zona jempol (§2.1). Aksi massal hanya desktop |
| Tugas saya, detail tugas, komentar | ✓ | ✓ | Kotak komentar menempel di bawah |
| Buat tugas | ✓ | ✓ | Bottom sheet cepat |
| Board / List / Kalender | ✓ | ✓ | Board satu kolom, kalender agenda |
| File & dokumen Drive | ✓ | ✓ | Buka di aplikasi Google, unggah dari kamera/galeri |
| Inbox & notifikasi | ✓ | ✓ | Lewat lonceng di app bar (atau tab ke-4 bila Obrolan mati). Geser untuk arsip/dibaca |
| Cari | ✓ | ✓ | Layar penuh, kolom cari di bawah |
| Dashboard Kadiv / HR | ✓ | ✓ | Versi ringkas 1 kolom (HR: pengajuan menunggu HR, ringkasan absensi, Hiring — keputusan pemilik 6 Okt 2026) |
| Dashboard Direksi (`/dashboard/direksi`) | ✓ | ✓ | Tab **Harian · Mingguan · Proyek · Catatan**, kartu bertumpuk; matriks mingguan = baris kotak hari per orang; detail laporan = bottom sheet; akses cepat workspace di tab Proyek; ekspor hanya desktop |
| Absensi › Hari ini · Rekap · Kedisiplinan | ✓ | ◐ | Tab bergaris bawah; Kedisiplinan: KPI 2×2, tren ringkas, daftar orang (chip filter); ekspor di desktop |
| Dashboard Manajemen (`/manajemen`) | ✓ | ✓ | Kartu bertumpuk: hero kehadiran + tugas, 2 tile KPI, grafik ringkas, daftar proyek, absensi, milestone (MgPDashboard), **beban kerja** per divisi (buka per orang) dan **catatan tindakan** |
| Portofolio & detail proyek (Direksi) | ✓ | ✓ | Tabel proyek → kartu proyek; roadmap hanya desktop (mobile: milestone berikutnya per kartu); "Minta update" & "Beri arahan" di bilah aksi bawah |
| Pengaturan notifikasi & tema | ✓ | ✓ | Matriks → daftar accordion |
| Hiring (`/hiring`, keputusan pemilik 6 Okt 2026) | ✓ | ✓ | Papan per tahap → chip tahap + daftar kartu; profil kandidat satu kolom (Ringkasan di tab Profil); pindah tahap lewat menu (tanpa seret); FAB tambah kandidat/lowongan. Hanya HR, Super Admin, dan pewawancara/penyetuju yang ditugaskan |
| Admin karyawan | ✓ | ◐ | Cari & lihat profil. Tambah/ubah/impor dan "Atur kata sandi" di desktop |
| Permintaan reset kata sandi (HR) | ✓ | ✓ | Panel di Admin › Karyawan & profil; Setujui / Tolak juga di ponsel karena karyawan menunggu |
| Struktur organisasi | ✓ | ◐ | Daftar bertingkat, bukan bagan. **Tidak untuk staf** di kedua platform (404, keputusan pemilik 6 Okt 2026) |
| Alur persetujuan, jenis cuti | ✓ | — | Banner "Buka di desktop" bila diakses |
| Lokasi, shift, hari libur | ✓ | — | Sama |
| Pengaturan workspace lanjutan | ✓ | ◐ | Anggota bisa dilihat. Kolom status & label di desktop |
| Rekap & ekspor bulanan | ✓ | ◐ | Ringkasan saja. Ekspor Excel/PDF di desktop |
| Audit log, impor CSV | ✓ | — | |

Fitur ◐ dan — di mobile tetap punya rute. Rute itu menampilkan versi baca-saja atau banner: *"Fitur ini tersedia di desktop."* + tombol "Kirim tautan ke email saya". **Jangan** menampilkan tata letak desktop yang terpotong di ponsel.

## 4. Aturan sentuh & tipografi mobile

- Target sentuh ≥ 44×44 px. Baris daftar ≥ 56 px (desain: 60–72). Tombol utama 52 px (`size="lg"`).
- **Input `font-size: 17px`** (Tipografi "Ponsel"; mencegah zoom otomatis iOS). Tinggi input 44–48 px.
- Padding samping 16 px. Teks dasar 17 px (`text-body`), judul layar 32/40 (`text-display`), judul bar layar turunan 17 px.
- Hormati *safe area* (`env(safe-area-inset-*)`) untuk tab bawah dan bilah aksi.
- Tab bawah = **kapsul** (TabBar.dc.html): kaca (`.tab-bar-surface`), `rounded-full`, 12px dari tepi kiri/kanan (`--tab-bar-inset`), melayang 14px di atas safe area (`--tab-bar-lift`), tinggi 70px (`--tab-bar-capsule`), lebar maks 420px di tengah. Tab aktif = pil **gradien aksi** (malam: gradien terang + tinta gelap, `--grad-active`) dengan label putih yang bergeser (transform 180ms `ease-brand`, instan dengan `prefers-reduced-motion`); label 12px tebal, ikon 24px, badge merah di Obrolan (pesan belum dibaca) atau Inbox (bila slot ke-4 = Inbox). Tab tengah **Absen** tidak memakai pil: tombol bulat 54px gradien aksi, naik 26px di atas kapsul dengan cincin 4px warna permukaan; saat aktif labelnya tebal berwarna teks utama. Semua elemen yang menempel di atas tab bar (padding konten, FAB, bilah aksi, toast) memakai `--tab-bar-height`, jangan angka tetap.
- Keyboard: saat input fokus, bilah aksi bawah ikut naik (pakai `visualViewport`), tab bawah disembunyikan.
- Glass hanya untuk app bar (saat menggulir), tab bawah, bottom sheet, toast.
- Tidak ada interaksi yang hanya mengandalkan hover. Pintasan keyboard hanya desktop.

## 5. Implementasi (Inertia + React)

```
resources/js/
├── layouts/
│   ├── AppLayout.tsx          # memilih shell sesuai breakpoint
│   ├── DesktopLayout.tsx      # MenuBar + Dock (desktop) / Rail (tablet), prop width
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
6. **PWA:** manifest (nama, ikon, `display: standalone`, `theme_color` teal), service worker hanya untuk shell & aset statis (data selalu dari jaringan). Halaman offline sederhana: "Anda sedang offline. Check-in butuh koneksi." Antrean offline (canvas mobile-first › Offline) hanya untuk aplikasi native Fase 3.
7. **Uji:** setiap halaman diuji di 3 lebar (375, 834, 1440) memakai Playwright (snapshot visual). Dark & light masing-masing.

## 6. Pemetaan layar mockup

| Fitur | Desktop (canvas) | Mobile (canvas) |
|---|---|---|
| Login | Login | MLogin |
| Beranda / dashboard pribadi | DashboardSaya | MBeranda |
| Menu & workspace | Dock (Dock.dc.html) | MMenu |
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
| Dashboard Direksi (monitoring kerja, keputusan pemilik 6 Okt 2026) | — (disusun dari primitif Arus: Panel, Progress, tabel DHR) | — (tab Harian · Mingguan · Proyek · Catatan) |
| Portofolio proyek (`/portofolio`) | DashboardDireksi | MDashboardDireksi |
| Detail proyek | ProyekDetail | MProyekDetail |
| Admin karyawan | Karyawan | MKaryawan (terbatas) |
| Struktur org, alur, lokasi/shift, pengaturan workspace, kiosk | ada | desktop saja / terbatas |

**Pratinjau Fase 2 & 3** (rute `routes/prototype.php`, data contoh; acuan = paket desain Arus `docs/ruangkerja-design/screens/*.dc.html`, bukan canvas mockup lama). Rincian & gambar: `docs/fitur/`.

| Fitur (rute) | Desktop (Arus) | Mobile (Arus) |
|---|---|---|
| Obrolan (`/obrolan`, `/obrolan/{channel}`) | 3 kolom: daftar · percakapan · thread/detail (≥ 1280; di bawahnya Sheet kanan), tanpa layar desain khusus | daftar layar penuh + FAB, percakapan layar penuh, aksi pesan/thread/detail = bottom sheet |
| Catatan bersama (`/catatan`, `/catatan/{note}`) | panel pohon per workspace; editor dengan panel kiri "Tab dokumen" (≥ 1024) + "Workspace" (pohon, ≥ 1280), riwayat di panel kanan (tanpa layar desain khusus) | editor layar penuh, strip tab dokumen, toolbar format di atas tab bar/keyboard, riwayat & tab = bottom sheet |
| Rapat (`/rapat`, `/rapat/baru`, `/rapat/{id}`) | DRapat, DRapatBaru, DNotifRapat (toast) | MRapat, MRapatDetail, MNotifRapat (bottom sheet) |
| Notulen (`/rapat/{id}/notulen`) | DNotulen | MNotulen (ubah PIC/tenggat ◐ desktop) |
| Kalender (`/kalender`) | grid bulan + tampilan minggu | strip minggu + agenda |
| Jadwal manajemen (`/manajemen/jadwal`) | MgJadwal (tablet TfJadwal) | MgPJadwal, MgPNotulen |
| WhatsApp, otomasi, berulang, template (`/pengaturan/whatsapp`, `/otomasi*`) | SPengaturan (tab WhatsApp), tabel + dialog | MSPengaturan, kartu + FAB + bottom sheet |
| Kinerja saya (`/kinerja`) | SKinerja | MSKinerja (KPI 2×2) |
| Aplikasi ponsel (`/pratinjau/ponsel/*`, `/absensi/wajah`, `/pengaturan/perangkat`) | PhoneStage: penjelasan + Simulasi + bingkai 390×844 | MLogin, MLockScreen, MWidget, MOffline, MQuickAdd, MFondasi, MAbsen/MSukses (layar OS tanpa shell) |
| OKR (`/okr`, `/okr/{objective}`) | turunan DPortofolio/DProyek (tanpa layar khusus) | kartu + chip divisi, KR = bottom sheet |
| Mesin fingerprint (`/admin/mesin-absensi`) | tabel + Sheet detail + dialog ADMS | ◐ baca-saja + "Kelola di desktop" |
| Dashboard per peran (`/peran/{role}`) | RoleDesk, Peran*, P* (Sheet 560 px) | RolePhone, PeranM*, P* (bottom sheet) |
