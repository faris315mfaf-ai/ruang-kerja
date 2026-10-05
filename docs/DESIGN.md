# Design System — RuangKerja ("Arus")

> Gaya: **Arus** — latar tenang dengan dua cahaya (teal kiri atas, biru kanan atas), kartu putih bersudut lebar, **gradien hanya untuk aksi & identitas**, huruf Figtree besar (isi 16px desktop, 17px ponsel), kaca untuk lapisan mengambang. Mode terang & **Malam**, Bahasa Indonesia.
> Sumber kebenaran visual: paket desain `docs/ruangkerja-design/` (baca README-nya, terutama cara membaca `.dc.html`). Token ada di `resources/css/tokens.css` (+ `palette.css`), utilitas Tailwind di `resources/css/app.css` (`@theme inline`). Panduan untuk agent modul: **`docs/design/ARUS-GUIDE.md`**. Acuan hidup komponen: **`/dev/komponen`** (lokal, Super Admin).

## 1. Prinsip

1. **Konten dulu, tenang.** Latar netral bercahaya tipis; warna kuat hanya untuk aksi utama, fokus, dan status penting.
2. **Satu gradien aksi per area.** Tombol utama, ubin Dock aktif, satu kartu KPI sorotan. Gradien hangat maksimal satu per layar.
3. **Kaca hanya di lapisan mengambang.** Menu bar, Dock, Rail, tab bar, app bar saat menggulir, popover/stack, dialog, sheet, command palette. **Tidak** untuk tabel, form, atau kartu.
4. **Keyboard-first.** Aksi utama punya pintasan dan ada di command palette (⌘K / Ctrl K).
5. **Status selalu ikon/titik + teks**, tidak pernah warna saja.
6. **Tidak ada hex di komponen.** Warna, gradien, bayangan, radius dari token (dijaga uji `lib/color-tokens.test.ts`).

## 2. Warna

Semua nilai dari `docs/ruangkerja-design/README.md` + `screens/Main.dc.html`. Nama variabel lama dipertahankan (kode lama tetap jalan); kolom "Utilitas" = kelas Tailwind.

### Netral & permukaan
| Token | Terang | Malam | Utilitas | Pakai |
|---|---|---|---|---|
| `--bg` | `#F3F6FA` | `#070B14` | `bg-background` | latar halaman (+ `--page-glow`) |
| `--surface` | `#FFFFFF` | `#0F1622` | `bg-surface` | kartu, input |
| `--surface-2` | `#EEF2F7` | `#172131` | `bg-surface-2` | hover, trek segmented, chip netral |
| `--border` | `#DDE4EC` | `#233247` | `border-border` | garis kartu |
| `--border-strong` | `#C3CEDA` | `#34465E` | `border-border-strong` | input, tombol outline |
| `--divider` | `#EEF2F7` | `#172131` | `border-divider`, `divide-divider` | pemisah baris dalam kartu |
| `--text` | `#0B1A2B` | `#EAF1F8` | `text-text` | teks utama |
| `--text-muted` | `#46576B` | `#A6B4C6` | `text-text-muted` | teks sekunder (≥ 4,5:1) |
| `--text-subtle` | `#8495A8` | `#7D8FA5` | `text-text-subtle` | placeholder, ikon dekoratif, nonaktif — **bukan teks yang harus dibaca** |

### Merek & aksi
| Token | Terang | Malam | Utilitas / catatan |
|---|---|---|---|
| `--brand-50…900` | ramp Teal SPKD (`#E8FBF8` … `#0B3A42`) | sama | `bg-brand-*`; utama terang = 600, malam = 400 |
| `--primary` | `#0B7F86` (teal 600) | `#2DBFB1` (teal 400) | `bg-primary`, `text-primary`, `--primary-fg` putih / `#041421` |
| `--ring` | teal `#14B8A6` 40% | `#2DBFB1` 45% | `ring-ring` (fokus 3px; input `ring-4 ring-ring/55`) |
| `--accent-blue` / `--accent-blue-strong` | `#2F7BEA` / `#1E5FD6` | sama | ikon, isian; teks putih hanya di atas `-strong` |
| `--link` / `--link-soft` | `#09656E` / `#E8FBF8` | `#5AD6C8` / `#0E2A2C` | tautan teal, tombol `tonal`, chip "WFH/Konten" |

### Semantik (pasangan teks + latar lembut)
| Makna | Teks terang / lembut | Teks malam / lembut | Utilitas |
|---|---|---|---|
| Sukses · hadir · sesuai jalur | `#0F7A55` / `#E3F6EE` | `#4ADE9B` / `#0E2A20` | `text-success` + `bg-success-soft` |
| Peringatan · terlambat · berisiko | `#9A5800` / `#FFF1DC` | `#F6B95C` / `#2E2210` | `text-warning` + `bg-warning-soft` |
| Bahaya · alpha · bermasalah | `#C42137` / `#FDE7EA` | `#FF7A8A` / `#3A1520` | `text-danger` + `bg-danger-soft` |
| Info · cuti · izin | `#1A4CB0` / `#E6EEFE` | `#A9C2FF` / `#14223F` | `text-info` + `bg-info-soft` |
| Netral · libur | `--text-muted` / `--surface-2` | | `text-text-muted` + `bg-surface-2` |

Isian grafik & titik (bukan teks): `bg-fill-teal` (#14B8A6), `bg-fill-warning` (#E08A00), `bg-fill-danger`, `bg-fill-violet` (#6D4AE0), penanda rencana `bg-marker`. Badge angka notifikasi: `bg-badge text-on-badge` (merah, sama di dua tema). Chip inverse (label Dock, toast): `bg-inverse text-on-inverse`. Avatar inisial: `bg-avatar-{blue|teal|amber|neutral}` + `text-avatar-*-fg` (pilih lewat `avatarTone(name)`). Warna tetap di dua tema: `qr-ink`/`qr-paper` (QR kiosk) dan `preview-light`/`preview-dark` (contoh tema di Pengaturan › Tampilan).

### Gradien
| Token | Nilai | Utilitas | Pakai |
|---|---|---|---|
| `--grad-aksi` | `135deg #0B7F86 → #1E5FD6` | `bg-grad-aksi` | tombol utama, tab/segmented aktif, KPI sorotan (`bg-grad-highlight` = + cahaya sudut) |
| `--grad-merek` | `135deg #14B8A6 → #2F7BEA` (`-x` 90°, `-y` 180°) | `bg-grad-merek(-x/-y)` | logo, avatar workspace, isian progres/grafik. Bukan untuk teks |
| `--grad-hangat` | `135deg #C2410C → #BE185D` | `bg-grad-hangat` | perhatian/perayaan, maks. satu per layar |
| `--grad-indigo` | `135deg #2F7BEA → #6D4AE0` | `bg-grad-indigo` | identitas kedua (workspace) |
| `--grad-slate` | `#46576B → #0B1A2B` | `bg-grad-slate` | workspace Pribadi, "Semua workspace" |
| `--grad-soft` | teal-50 → blue-50 (malam gelap) | `bg-grad-soft` | ubin ikon empty state |
| `--grad-active` | terang = aksi; malam `#2DBFB1 → #5B8CF6` + tinta `#041421` | `bg-grad-active` + `text-on-active` | ubin Dock aktif, pil tab bar |
| `--page-glow` | dua radial 1000×480 (teal 20%, biru 18%) | `bg-page` | latar `body` (otomatis) |

Palet label (`palette.css`, `lib/palette.ts`): `gray · slate · teal · blue · green · amber · orange · red · violet · pink` dalam rona Arus; `paletteGradient(color)` memetakan ke gradien ubin workspace/kode proyek.

## 3. Tipografi

- **Figtree** 400–800 (UI) dan **JetBrains Mono** 500/600 (ID tugas `PLQ-18`, nomor pengajuan, jam di tabel), di-host sendiri lewat `@fontsource` (CSP memblokir Google Fonts). Plus Jakarta Sans sudah dihapus.
- Angka tabular (`tnum`) aktif di seluruh `body`.
- Skala sebagai utilitas (nilai ponsel < 768px otomatis berganti lewat `tokens.css`):

| Utilitas | Desktop/tablet | Ponsel | Contoh |
|---|---|---|---|
| `text-display` | 44/52 · 800 · −0.03em | 32/40 | "Selamat pagi, Dimas", judul layar ponsel |
| `text-h1` | 34/42 · 700 | 26/32 | judul halaman sekunder |
| `text-h2` | 26/34 · 700 | 22/28 | judul seksi besar |
| `text-h3` | 22/30 · 700 | 20/26 | judul kartu/panel |
| `text-title` | 18/26 · 600 | 17/24 | judul item |
| `text-body-lg` | 18/28 | 18/28 | pengantar |
| `text-body` | 16/24 | 17/26 | teks dasar (default `body`) |
| `text-label` | 15/22 · 600 | 15/20 | label form, tombol kecil |
| `text-meta` | 14/20 · 500 | 13/18 | waktu, nama file (sekunder) |
| `text-overline` | 14/20 · 700 · kapital · 0.06em | sama | label seksi, tanggal di atas judul |
| `text-kpi` | 40/48 · 700 | 28/34 | angka KPI |

- Teks yang harus dibaca minimal 14px (ponsel 15px; 13px hanya meta). Input ponsel 17px (iOS tidak zoom).
- Berat 800 hanya untuk judul besar/angka sorotan.

## 4. Ruang, radius, elevasi, ukuran

- Grid 4px. Jarak umum: 4 · 8 · 12 · 16 (gutter ponsel) · 20 (antar kartu) · 24 (padding kartu) · 32 (antar seksi) · 40 (padding halaman desktop).
- Radius (`rounded-*`): `sm` 8 chip/badge · `md` = `control` 12 tombol/input · `lg` 16 ubin/item · `xl` = `card` 20 kartu KPI · `2xl` = `panel` 24 panel/kartu seksi · `3xl` = `sheet` 28 sheet. (`xs` 6 untuk kbd.)
- Elevasi: `shadow-card` (e-1, kartu) · `shadow-float` (e-2, popover/sheet) · `shadow-glow` (KPI & elemen gradien) · `shadow-button`/`shadow-button-lg` (tombol gradien) · `shadow-warm` · `shadow-inverse` (toast) · `shadow-segment` (tab terpilih) · `shadow-knob` (switch). Malam memakai bayangan hitam tipis + border.
- Tinggi kontrol: `h-control-sm` 36 (toolbar, chip) · `h-control` 44 (tombol & input desktop, sentuh minimum) · `h-control-lg` 52 (aksi utama ponsel) · `h-control-xl` 56.
- Kaca: `.glass` (bar/rail, 72% + blur 24) dan `.glass-strong` (popover, dialog, sheet, palette; 82%/88% + blur 30). `prefers-reduced-transparency` → permukaan solid.

## 5. Tata letak & shell

| Lebar | Shell |
|---|---|
| ≥ 1024 | **MenuBar** kaca 64px (merek, breadcrumb 16px, chip status absensi + pil Check-in, cari ⌘K/Ctrl K, lonceng berangka, avatar bercincin gradien) · konten di kolom **1280px** (`width: 'wide'` 1480px untuk board/tabel besar, `'full'` bila halaman mengatur kolomnya sendiri) dengan padding 40px · **Dock** mengambang 20px dari bawah |
| 768–1023 | **Rail** kaca 96px di kiri (merek, Cari, tujuan utama, stack Workspace/Organisasi/Admin, avatar = menu akun); tanpa menu bar & Dock; padding konten 24px |
| < 768 | **App bar** berjudul besar (32/40) + tombol bulat 48px; Beranda: tanggal (overline) + sapaan + avatar; layar turunan: bar 56px lengket dengan tombol kembali bulat · **Tab bar kapsul** 70px |

**Dock** (Dock.dc.html): urutan Dashboard · (Portofolio · Manajemen) · Inbox · Tugas saya · Absensi · Pengajuan · Persetujuan │ workspace favorit (ubin huruf bergradien) · stack Workspace │ stack Organisasi · stack Admin. Ubin 52px putih (malam 8% putih) radius 28%, aktif `--grad-active`, titik 5px di bawah, label chip inverse di atas, badge merah. Magnifikasi pegas critically damped (52 → 74px), loop glyph tanpa sambungan saat disorot (berhenti dengan reduced motion). Stack = popover kaca 372px, grid 3 kolom ubin 52px bergradien. Setiap tujuan hanya di satu tempat (favorit juga tercantum di stack Workspace). Model navigasi bersama Dock & Rail: `components/shell/use-shell-navigation.ts`.

Detail platform & matriks fitur: **`docs/PLATFORM.md`**.

## 6. Komponen utama

Semua di `resources/js/components/ui/*` (API shadcn tetap kompatibel; varian Arus ditambahkan). Contoh hidup: `/dev/komponen`.

| Komponen | Arus |
|---|---|
| **Button** | `default` gradien aksi + glow · `outline` (surface + border kuat, "Ekspor") · `tonal` (teal lembut, "Minta update") · `quiet` (teks teal, "Batal") · `ghost` (netral, ikon) · `secondary` · `destructive` · `link`. Ukuran `sm` 36 · default 44 · `lg` 52 · `xl` 56 · `icon` 44 · `icon-sm` 36 · `icon-lg` 52. Nonaktif = abu `surface-2` |
| **Input / Textarea / Select** | 44px, radius 12, border kuat, fokus border teal + cincin 4px lembut, galat `aria-invalid` merah; `fieldClasses` diekspor dari `input.tsx` |
| **Checkbox / Radio / Switch** | 24px radius 7 (tercentang = gradien aksi) · radio native 24px (cincin 7px teal) · switch 52×32 (`md`) / 40×24 (`sm`), aktif gradien |
| **Label** | 15/22 semibold |
| **Badge** | `status` 32px pil lembut + `dot` (tone success/warning/danger/info/link/neutral) · `label` 30px radius 8 · `count` merah · default "Baru" gradien |
| **SegmentedTabs** (`ui/tabs.tsx`) | WAI-ARIA tabs (←/→/Home/End): `soft` (trek abu, pilihan putih), `glass` (trek tembus), `solid` (pilihan gradien, MgDashboard) |
| **TabNav** | navigasi bergaris bawah 3px teal ("Tugas · Dokumen 6 · File 24") |
| **Card / Panel** | radius 24, border, `shadow-card`, padding 24; `Panel` = kartu berjudul + aksi (`PanelLink` teal 44px) |
| **KpiCard** | `plain` / `highlight` (gradien aksi + cahaya) / `warm`; nilai `text-kpi`, pil delta lembut |
| **Progress** | trek `surface-2`, isian gradien merek, penanda rencana opsional, `role="progressbar"` |
| **ListRow** | ≥ 72px, avatar/ikon, judul 17/600, meta 15, trailing atau chevron |
| **Avatar / UserAvatar** | inisial bernada per orang; `ring` = cincin gradien merek (pengguna sendiri) |
| **Dialog / Sheet / Dropdown / Select menu / Command** | `glass-strong`, radius 16–28, `shadow-float`, item ≥ 40px, label seksi 13px kapital |
| **Tooltip / Toast** | chip inverse (`bg-inverse`), toast radius 18, ikon status berwarna terbaca, aksi "Urungkan" pil tembus |
| **Table** | kepala `bg-background` 14px tebal abu, baris pemisah `divider`, hover `surface-2/60`, sel 16px padding |
| **EmptyState** | `md`: kartu putus-putus radius 24, ubin ikon 64px `bg-grad-soft`, judul 20, satu aksi · `sm`: ringkas di dalam panel |
| **Skeleton** | blok `surface-2` radius 12, berdenyut (diam dengan reduced motion) |
| **Mobile** | `ChipScroller` 42px (aktif gradien), `Fab` 60px radius 20 gradien, `BottomSheet` kaca radius 28, `SwipeableRow`, `appBarIconButton` 48px |

Ikon: **Lucide**, garis 1,9–2, 20px UI · 22–24px navigasi. Status tugas & prioritas: `components/status-icon.tsx`, `priority-icon.tsx` (Ruang.dc.html).

## 7. Gerak

- Durasi 120 ms (hover, toggle), 180 ms (popover, sheet, pil tab), easing `ease-brand` = `cubic-bezier(.2,.8,.2,1)`; Dock memakai pegas.
- Hanya `transform`/`opacity` bila bisa; tekan = skala 0,98 (tombol) / 0,9 (ubin Dock, ikon tab).
- Loop ikon/ambient tanpa sambungan (frame awal = frame akhir), berhenti di frame diam saat `prefers-reduced-motion` (aturan global di `tokens.css`).
- Panduan kerja dengan agent (skill `animate`, `review-animations`, `motion-design`, `apple-hig`): lihat CLAUDE.md.

## 8. Bahasa & tulisan UI

- Bahasa Indonesia baku tapi ringkas dan ramah: "Check-in berhasil", "Tugas saya", "Ajukan cuti", "Tenggat", "Penanggung jawab".
- Istilah yang dipakai konsisten: *Tugas* (task), *Workspace*, *Pengajuan*, *Persetujuan*, *Tenggat*, *Check-in/Check-out*.
- Tanggal: `Sab, 3 Okt 2026`. Jam: `08.05` (format Indonesia, titik). Relatif: "2 jam lalu", "besok".
- Angka: `1.250` (titik ribuan), persen `92%`.
- Pesan galat menyebut solusi: "Anda berada 340 m dari Kantor Pusat (batas 100 m). Ajukan dinas luar jika sedang bertugas di luar."

## 9. Aksesibilitas

- Kontras teks ≥ 4.5:1 di kedua mode, dicek untuk semua pasangan token (Okt 2026): teks/surface 17,6 · muted/bg 6,8 · putih/primer 4,8 · status/lembut ≥ 4,75 (terang) dan ≥ 6,4 (malam) · tinta/aksi malam 8,2. Tidak ada pasangan yang perlu disesuaikan.
- `--text-subtle` (≈ 3:1) hanya placeholder, ikon dekoratif, elemen nonaktif.
- `--accent-blue` & isian `fill-*` untuk gradien, ikon, titik; teks berwarna memakai token semantik. Teks putih di atas biru memakai `accent-blue-strong`.
- Fokus selalu terlihat: cincin 3px teal (`focusRing` di `lib/utils.ts`). Seluruh aplikasi bisa dipakai dengan keyboard.
- Target sentuh ≥ 44px; tab bar ≥ 58px.
