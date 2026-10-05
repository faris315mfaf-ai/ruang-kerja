# Panduan Arus untuk agent modul

Fondasi sistem desain **Arus** sudah global (token, komponen, shell). Tugas agent modul: menulis ulang **isi** setiap halaman agar sama dengan layar desain, memakai primitif di bawah, tanpa membuat gaya baru. Baca juga `docs/DESIGN.md` (token & aturan), `docs/PLATFORM.md` (desktop/tablet/ponsel), dan `docs/ruangkerja-design/README.md` (cara membaca `.dc.html`).

Acuan hidup: buka **`/dev/komponen`** (APP_ENV=local, login `admin@demo.test`) berdampingan dengan `screens/Komponen.dc.html`.

## 1. Alur kerja per halaman

1. Buka layar desain di tabel §2 (desktop, ponsel, dan versi `…Malam`). Baca markup **dan** `renderVals()` (data contoh = bentuk data yang diharapkan).
2. Ganti data contoh dengan props controller yang sudah ada. **Jangan** menambah endpoint/kolom tanpa membaca `docs/DATABASE.md`; fitur Fase 2 (Rapat, Notulen, Kinerja, Widget, Lock screen, Offline queue, peran SPKD khusus) **tidak** dibangun kecuali diminta — tampilkan EmptyState "Modul … belum aktif" bila panelnya ada di desain.
3. Satu komponen untuk dua tema: versi `Malam` hanya untuk mengecek warna; semua warna sudah otomatis lewat token.
4. Jaga struktur `*.desktop.tsx` / `*.mobile.tsx` + hook bersama. Shell (MenuBar, Dock, Rail, tab bar, app bar) **tidak** dirender ulang di halaman — `MenuBar`/`Dock`/`TabBar`/`Rail` di file desain = shell yang sudah ada.
5. Cek 1440 terang+malam, 834 (Rail), 390 terang+malam; tidak ada gulir horizontal; jalankan uji (`npm test`, `npm run typecheck`, `npm run lint`, Pest).

## 2. Pemetaan rute → layar desain

Kolom: **D** desktop · **M** ponsel · **T** tablet. Setiap layar punya pasangan `…Malam.dc.html` (kecuali DBoard yang memang gelap). `S…`/`MS…` = tampilan staf (peran `anggota`), `D…`/`M…` = Kepala Divisi/umum, `Mg…`/`Tf…`/`MgP…` = manajemen.

| Rute | Halaman Inertia | D | M | Catatan |
|---|---|---|---|---|
| `/login` | `auth/login` | DLogin | MLogin | Biometrik di MLogin = Fase 3, pakai tombol Google + demo |
| `/forgot-password`, `/reset-password`, `/two-factor-challenge`, `/confirm-password`, `/verify-email` | `auth/*` | DLogin (gaya kartu) | MLogin | `AuthSimpleLayout` |
| `/dashboard`, `/dashboard/saya` | `dashboard/personal` | SBeranda | MSBeranda (staf) · MBeranda | `appBar: 'greeting'` |
| `/dashboard/divisi` | `dashboard/division` | DBeranda · DMonitorTugas | MBeranda | KPI = `KpiCard`, panel = `Panel` |
| `/dashboard/hr` | `dashboard/hr` | DHR · PeranHR | PeranMHR · PHRLive | |
| `/manajemen` | `manajemen/dashboard` | MgDashboard | MgPDashboard | **Sudah Arus** (contoh acuan). T: TfDashboard |
| `/portofolio` | `projects/portfolio` | DPortofolio · PeranDirut | PDirutPortofolio · PeranMDirut | |
| `/w/{ws}/ringkasan` | `workspaces/summary` | DProyek · MgProyek | MProyek · MgPProyek · MgPMilestone | T: TfProyek |
| `/w/{ws}` (board/list/kalender) | `workspaces/tasks` | DBoard · DTodo | MTodo | `width: 'wide'` |
| `/w/{ws}/dokumen`, `/file`, `/aktivitas`, `/pengaturan` | `workspaces/*` | DProyek (tab) · SProyekSaya | MSProyekSaya | `TabNav` untuk tab workspace |
| `/workspace` | `workspaces/index` | SProyekSaya | MSProyekSaya | |
| `/tugas` | `tasks/mine` | STugasSaya | MTugas | `ChipScroller`, `Fab` |
| `/tugas/{task}`, `/w/{ws}/tasks/{n}` | `tasks/show` | DTugas · SDetailTugas | MSDetailTugas | |
| `/absensi` | `attendance/index` | DAbsensi · SAbsensi | MAbsen → MSukses | `appBar: 'greeting'`; tombol check-in `size="lg"` |
| `/absensi/riwayat` | `attendance/history` | SAbsensi | MSRiwayat | |
| `/absensi/hari-ini` | `attendance/board` | DHR (live) · MgAbsensi | PHRLive · MgPAbsensi | T: TfAbsensi |
| `/absensi/rekap` | `attendance/recap` | MgAbsensi · DHR | — (ringkas) | `width: 'wide'` |
| `/absensi/kebijakan-data` | `attendance/privacy-policy` | SPengaturan (gaya) | MSPengaturan | |
| `/pengajuan` | `requests/index` | SPengajuan | MSPengajuanSaya | |
| `/pengajuan/baru`, `/{id}/ubah` | `requests/form` | SFormPengajuan | MSFormPengajuan | |
| `/pengajuan/{id}` | `requests/show` | SPengajuan (detail) | MSPengajuanSaya | |
| `/persetujuan` | `approvals/index` | DPersetujuan · PDirekturSetuju | MPersetujuan · PHRCuti | `width: 'wide'` |
| `/persetujuan/{id}` | `approvals/show` | DPersetujuan (panel) | MPersetujuan | |
| `/inbox` | `inbox/index` | DInbox | MInbox · MNotifCenter | |
| `/cari` | `search/index` | (command palette) | MInbox (gaya daftar) | Desktop/tablet memakai palette |
| `/menu` | `menu` | — | MMenu | |
| `/pengaturan/notifikasi` | `notifications/settings` | SPengaturan | MSPengaturan | |
| `/settings/profile`, `/security`, `/google`, `/appearance` | `settings/*` | SPengaturan | MSPengaturan | |
| `/privasi`, `/kebijakan-privasi` | `privacy/*` | SPengaturan | MSPengaturan | |
| `/organisasi/struktur` | `organization/structure` | MgPDivisi (gaya) | MgPDivisi | |
| `/admin/organisasi` | `admin/organization/index` | DHR (gaya tabel) | — (DesktopOnlyNotice) | |
| `/admin/karyawan`, `/{id}`, `/impor` | `admin/employees/*` | DHR · PeranHR | PeranMHR (baca) | |
| `/admin/absensi`, `/penugasan` | `admin/attendance/*` | DHR (gaya) | — | |
| `/admin/pengajuan` | `admin/request-types` | DHR (gaya) | — | |
| `/admin/saldo-cuti` | `admin/leave-balances` | PHRCuti (gaya) | — | |
| `/admin/audit` | `admin/audit/index` | DHR (gaya tabel) | — | |
| `/admin/dokumentasi` | `admin/docs/index` | Komponen (kartu + daftar) | baca saja | |
| `/kiosk/*` | `kiosk/*` | — (layar penuh) | — | Pakai token; QR tetap `qr-ink`/`qr-paper` |
| `/dev/komponen` | `dev/komponen` | Komponen | Komponen | Acuan, lokal saja |

Layar tanpa rute (Fase 2/3, jangan dibangun tanpa permintaan): DRapat, DRapatBaru, DNotulen, DNotifRapat, MRapat*, MNotulen, MNotifRapat, SKinerja/MSKinerja, MWidget, MLockScreen, MOffline, MQuickAdd (bisa dipakai sebagai referensi sheet aksi cepat `Fab`), Peran* & P* (dashboard per peran SPKD), RoleDesk/RolePhone.

## 3. Menerjemahkan `.dc.html` ke React

| Di desain | Di kode |
|---|---|
| `background: #FFFFFF; border: 1px solid #DDE4EC; border-radius: 24px; box-shadow: 0 1px 2px …, 0 8px 24px …` | `Card` / `Panel`, atau `rounded-panel border border-border bg-surface shadow-card` |
| radius 20 (KPI) / 22 / 16 / 12 / 8 | `rounded-card` / `rounded-[22px]` / `rounded-lg` / `rounded-control` / `rounded-sm` |
| `linear-gradient(135deg, #0B7F86 0%, #1E5FD6 100%)` | `bg-grad-aksi` (tombol: `<Button>`) |
| `#14B8A6 → #2F7BEA` (90° di bar) | `bg-grad-merek` / `bg-grad-merek-x` |
| `#C2410C → #BE185D` · `#2F7BEA → #6D4AE0` | `bg-grad-hangat` · `bg-grad-indigo` |
| `radial-gradient(… rgba(255,255,255,0.22) …), grad aksi` (KPI sorotan) | `KpiCard tone="highlight"` / `bg-grad-highlight` |
| teks `#0B1A2B` / `#46576B` / `#8495A8` | `text-text` / `text-text-muted` / `text-text-subtle` |
| `#F3F6FA` (latar baris kepala tabel) / `#EEF2F7` | `bg-background` / `bg-surface-2` (garis baris: `border-divider`) |
| pil `#E3F6EE`+`#0F7A55` (Hadir) dll. | `<Badge variant="status" tone="success" dot>` |
| chip `#EEF2F7` 30px radius 8 ("Keuangan") | `<Badge variant="label">` (+ `tone`) |
| angka merah `#C42137` di bulatan | `<Badge variant="count">` / `bg-badge text-on-badge` |
| tautan `#09656E` | `text-link` (`PanelLink` untuk "Detail/Lihat semua") |
| tombol putih border `#C3CEDA` | `<Button variant="outline">` |
| tombol `#E8FBF8`/`#09656E` | `<Button variant="tonal">` · teks saja → `variant="quiet"` |
| input 44px radius 12 | `<Input>`, `<Select>`, `<Textarea>`, `<Label>` |
| tablist trek `#EEF2F7` / trek putih + border / pilihan gradien | `<SegmentedTabs variant="soft" | "glass" | "solid">` |
| tab bergaris bawah | `<TabNav>` |
| bar progres + penanda rencana | `<Progress value marker>` |
| baris daftar 60–72px dengan avatar | `<ListRow>` di dalam `divide-y divide-divider` |
| avatar `#D9E6FF`/`#1A4CB0` dsb. | `<UserAvatar name>` (nada otomatis); diri sendiri `ring` |
| ID `JetBrains Mono` | `font-mono font-semibold` (14–15px) |
| ukuran huruf skala | `text-display` … `text-meta`, `text-overline`, `text-kpi` (berubah otomatis di ponsel) |
| kotak kosong putus-putus | `<EmptyState>` (`size="sm"` di dalam panel) |
| skeleton | `<Skeleton>` seukuran isi asli |
| toast gelap "Urungkan" | `toast.success(…, { action })` (sonner sudah bergaya inverse) |
| sheet bawah / tombol + bulat 60px | `BottomSheet` · `Fab` |
| tombol ikon bulat 48px di header ponsel | `appBarIconButton` (`components/mobile/app-bar.tsx`) lewat `appBarActions` |
| `main { max-width: 1280px; padding: 40px }` | sudah dari shell; `width: 'wide'` (1480) atau `'full'` di `Page.layout` |

Aturan:
- **Tidak ada hex/rgb/kelas palet Tailwind** di `.tsx` (uji `lib/color-tokens.test.ts` gagal). Bila desain memakai warna yang belum ada tokennya, tambahkan token di `tokens.css` (+ `.dark`) dan `app.css @theme`, lalu catat di DESIGN.md.
- Ukuran px arbitrer (`text-[15px]`, `rounded-[22px]`) boleh bila tidak ada di skala, tetapi utamakan utilitas skala.
- Gabungkan kelas dengan `cn()` (tailwind-merge sudah mengenal utilitas Arus; utilitas baru di `@theme` harus didaftarkan di `lib/utils.ts`).
- Fokus kontrol buatan sendiri: `focusRing` dari `lib/utils.ts`.
- Status selalu teks + titik/ikon; gradien aksi maks. satu per area; gradien hangat maks. satu per layar.
- Ponsel: input 17px, target ≥ 44px, aksi utama `size="lg"` di sepertiga bawah, konten di atas `--tab-bar-height`.
- Animasi: 120/180 ms `ease-brand`, hanya transform/opacity, hormati reduced motion.

## 4. Daftar token & utilitas

- Warna: `background surface surface-2 border border-strong divider text text-muted text-subtle primary primary-hover success(-soft) warning(-soft) danger(-soft) info(-soft) link(-soft) fill-teal fill-warning fill-danger fill-violet marker accent-blue(-strong) brand-50…900 tag-* on-brand on-danger on-active badge on-badge inverse on-inverse avatar-{blue,teal,amber,neutral}(-fg) glass glass-border qr-ink qr-paper preview-light preview-dark` (+ alias shadcn: `card popover muted accent destructive input ring chart-1…5`).
- Gradien: `bg-grad-aksi bg-grad-merek(-x,-y) bg-grad-hangat bg-grad-indigo bg-grad-slate bg-grad-soft bg-grad-active bg-grad-highlight bg-page`.
- Radius: `rounded-xs(6) sm(8) md/control(12) lg(16) xl/card(20) 2xl/panel(24) 3xl/sheet(28)`.
- Bayangan: `shadow-card shadow-float shadow-glow shadow-button shadow-button-lg shadow-warm shadow-inverse shadow-segment shadow-knob`.
- Ukuran: `h-control-sm(36) h-control(44) h-control-lg(52) h-control-xl(56)` (juga `min-h-*`, `size-*`).
- Huruf: `text-display text-h1 text-h2 text-h3 text-title text-body-lg text-body text-label text-meta text-kpi text-overline`, `font-sans` (Figtree), `font-mono` (JetBrains Mono), `tnum`.
- Kaca: `.glass`, `.glass-strong`; shell: `--menu-bar-height --page-max --page-max-wide --page-pad --dock-space --rail-width --tab-bar-height --app-bar-height`.
- Komponen: `components/ui/{button,input,textarea,select,label,checkbox,radio,switch,badge,tabs,card,panel,kpi-card,progress,list-row,avatar,skeleton,table,dialog,sheet,dropdown-menu,tooltip,command,alert,toggle,toggle-group,sonner}`, `components/empty-state.tsx`, `components/mobile/*`, `components/shell/*`.

## 5. Sisa pekerjaan yang diketahui (untuk agent modul)

- Halaman masih memakai kelas lama di level fitur (mis. `text-[13px]`, `text-xs`, `rounded-xl` kartu buatan sendiri, `features/dashboard/panel.tsx` & `stat-card.tsx`, lingkaran inisial `bg-brand-600`): ganti dengan `Panel`, `KpiCard`, `UserAvatar`, skala huruf Arus saat halaman dikerjakan.
- `features/tasks/detail/task-detail-header.tsx` dan `features/notifications/inbox-app-bar-actions.tsx` punya `iconButton` sendiri → pakai `appBarIconButton`.
- Breadcrumb beberapa halaman tidak sesuai desain (mis. Persetujuan berada di bawah "Absensi"); rapikan bersama layoutnya.
- Email (`resources/views/mail/*`) sudah memakai hex Arus, tetapi tata letaknya belum didesain ulang.
