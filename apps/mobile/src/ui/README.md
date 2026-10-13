# Pustaka UI RuangKerja (Fondasi UI · modul 13)

Sumber visual: `docs/mockups/android/spec/13-fondasi-desain.md`, `docs/DESIGN.md`, `resources/css/tokens.css`.
Impor komponen dari `@/ui`, token dari `@/theme`. Semua teks UI Bahasa Indonesia; warna **hanya** dari token tema (`useTheme()`), tidak ada hex di layar.

## Akar aplikasi

`app/_layout.tsx`: `ThemeProvider` → `SafeAreaProvider` → **`UIProvider`** (gestur, sheet, dialog, snackbar) → `SessionProvider` → `UnreadProvider` (selalu membungkus navigator). Splash ditahan sampai sesi, tema tersimpan, dan font siap. `app/(tabs)/_layout.tsx` memakai `TabBar` + `AttendanceStatusProvider` + `TabBarSpaceProvider`.

## Tema (`src/theme`)

`useTheme()` → `{ colors, gradients, shadows, dark, mode, setMode, ready }`. `mode`: `'system' | 'light' | 'dark'` (disimpan di SecureStore `rk.tema`, juga memanggil `Appearance.setColorScheme` sehingga komponen native ikut). `useAppFonts()` memuat Figtree 400–800 + JetBrains Mono 500/600 (impor per bobot). Pakai `font(weight)` / varian `Text`; jangan `fontWeight` bersama font khusus.

| Web (`tokens.css`) | `colors.*` | Catatan |
|---|---|---|
| `--bg --surface --surface-2 --border --border-strong --divider` | `bg surface surface2 border borderStrong divider` | |
| `--text --text-muted --text-subtle` | `text muted subtle` | `subtle` ≈ 3:1: hanya placeholder/ikon dekoratif |
| `--primary(-hover/-fg) --ring` | `primary primaryHover primaryFg ring` | |
| `--link --link-soft` | `link linkSoft` | |
| `--success/warning/danger/info` + `-soft` | `success… successSoft…` | pasangan teks + latar lembut |
| `--on-danger --badge --on-badge` | `onDanger badge onBadge` | lencana `#C42137` + putih = 5,8:1 (AA) |
| `--accent-blue(-strong)` | `accentBlue accentBlueStrong` | |
| `--inverse --on-inverse --inverse-*` | `inverse onInverse inverseStatus.{success,danger,warning,info}` | snackbar |
| `--avatar-*` | `avatar.{blue,teal,amber,neutral}.{bg,fg}` | |
| `--brand-50…900`, `--fill-*`, `--marker` | `brand[50…900]`, `fill.*`, `marker` | |
| `--glass-bg/-strong/-border`, `--scrim` | `glass glassStrong glassBorder scrim` | lihat deviasi kaca |
| `--grad-*` | `gradients.{aksi,merek,hangat,indigo,slate,soft,active}` → `[dari, ke]` | `<Gradient name="aksi" />` |
| `--page-glow` | `<PageGlow />` | dua radial 420×260 (`experimental_backgroundImage`) |
| `--shadow-1/-2`, `--elev-*` | `shadows.{card,float,glow,button,warm,inverse,knob,segment}` | string `boxShadow` |

Bentuk & ukuran (`src/theme/tokens.ts`): `radius` (skala web `xs 6 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 28`, plus `control 14 · card 24 · cardTight 20 · hero 26 · full`), `space` (grid 4), `size` (`controlSm 36 · controlMd 44 · controlLg 52 · controlXl 56 · touch 48 · fab 60`), `layout` (`appBar 56 · tabBar 70 · tabInset 12 · tabLift 14 · gutter 16`), `motion` (`fast 120 · base 180 · ease cubic-bezier(.2,.8,.2,1)`). Tipografi: `type` (`display 32/40 · h1 26/32 · h2 22/28 · h3 20/26 · title 17/24 · bodyLg · body 17/26 · label 15/20 · meta 13/18 · overline 14/20 · kpi 28/34 · mono`).

> **`radius` ada dua.** `@/theme` = skala web (di atas). `@/lib/theme` (shim, dipakai layar lama) = skala lama `{sm 12, md 16, lg 20, xl 24}`. Kode baru memakai `@/theme`.

## Komponen (`@/ui`)

| Komponen | Props utama |
|---|---|
| `Text` | `variant` (`display…mono`) · `tone` (`text muted subtle primary link success warning danger info onPrimary onInverse onActive`) · `weight` 400–800 · `align`. Default `maxFontSizeMultiplier=2`. Varian `meta` default `muted`, `overline` default `link` |
| `Icon` | `name` (Lucide kebab-case **atau** nama Ionicons lama) · `size=22` · `color` · `strokeWidth=1.9` |
| `Pressable` | seperti RN (style statis), `scaleTo=0.98` (120 ms ease-brand, hormati reduced motion) |
| `Gradient` / `PageGlow` / `Glass` | `name` · `horizontal` / — / `strong`, `blurTarget?` |
| `Button` | `title onPress variant(primary·outline·tonal·quiet·secondary·danger·ghost) size(sm 40·md 52·lg 56) loading loadingTitle disabled disabledReason icon` |
| `IconButton` | `icon label(wajib) onPress variant(outline·ghost·primary) badge(number·true) size=48` |
| `Fab` | `icon label onPress extended` (posisikan sendiri; naik `useTabBarSpace()`) |
| `Field` | `label hint error required counter` — membungkus isian |
| `Input` | semua `TextInputProps` + `invalid disabled leftIcon suffix secureToggle right`; 52 px, radius 14, 17 px |
| `SearchInput` | `value onChangeText placeholder onSubmitEditing autoFocus` (pil) |
| `SelectField` | `value placeholder onPress` — memicu `BottomSheet` pilihan |
| `DateInput` | `label value('YYYY-MM-DD') onChange min max required error hint disabled`; tampil `Selasa, 13/10/2026`, ketik `dd/mm/yyyy`, kalender sheet. Helper: `tanggal.*` |
| `Switch` `Checkbox` `Radio` | `value/onValueChange` · `checked/onChange label` · `selected/onSelect label description` |
| `SegmentedTabs` (`Segmented`) / `TabNav` | `value options[{value,label,badge}] onChange variant(soft·solid)` |
| `Chip` / `ChipScroller` | `label selected onPress icon count variant(filter·tonal) onDismiss` |
| `Badge` `Tag` `CountBadge` | `tone(neutral·success·warning·danger·info·primary) dot` · — · `count dotOnly` |
| `Avatar` `AvatarStack` `Progress` | `name size(sm·md·lg) tone ring` · `names max` · `value marker label` |
| `Card` `Panel` `Hero` `KpiCard` `SectionHeader` | `variant(default·tight·flat) onPress` · `title actionLabel onAction` · `warm` · `label value delta deltaTone highlight` |
| `ListRow` / `IconTile` | `title subtitle leading icon iconTone trailing onPress divider` |
| `Banner` + `ReadOnlyBanner` `DesktopOnlyBanner` `LockedBanner` `OfflineBanner` | `tone(info·warn·bad·ok·neutral) title message icon actionLabel onAction` |
| `EmptyState` `ErrorState` `LockedState` | `icon title description actionLabel onAction` · `message onRetry kind(umum·offline·forbidden·notfound·ratelimit)` (`errorKindFromStatus(err.status)`) · `reason` |
| `Skeleton` `SkeletonRow` `Loading` | `width height` — kilau berhenti dengan reduced motion; `Loading` = beberapa baris skeleton |
| `BottomSheet` / `SheetAction` | `visible onClose title showClose scrollable snapPoints` · `icon label description tone onPress` |
| `Dialog` / `useDialog()` | `confirm({title,message,confirmLabel,destructive})→boolean` · `alert(...)` · `askReason({title,minLength})→string\|null` (pengganti `Alert.alert`) |
| `useSnackbar()` | `show({message, variant(ok·info·bad·warn·offline), actionLabel, onAction, duration, anchor})` |
| `AppBar` / `SubAppBar` | `title overline subtitle actions[{icon,label,onPress,badge}]` · `title onBack actions transparent` |
| `Screen` / `ActionBar` | `refreshing onRefresh contentStyle header footer scroll` — latar bercahaya, area aman, padding bawah kapsul otomatis |
| `TabBar` | custom `tabBar` di `(tabs)/_layout.tsx` |
| `Rail` | pengganti `TabBar` pada jendela ≥ 600 dp (`tabBarPosition: 'left'`): merek, Cari, Beranda, Tugas, Absen, Obrolan/Inbox, Rapat, Lainnya, avatar |
| `useTataLetak()` | `{ lebar, kelas('compact'·'medium'·'expanded'), rail, duaPanel, tigaKolom, lanskap }` dari lebar **jendela**; `lebarDaftar(t, 'tugas'·'obrolan')` |
| `PanelProvider` / `usePanel()` / `useKembali()` | detail yang ditanam di samping daftar (tablet): `SubAppBar`/header obrolan mengganti Kembali dengan Tutup (atau tanpa tombol); `useKembali()` = tutup panel atau `router.back()` |

Tombol tengah: `centerAction(action, endIso, now)` → `'absen' | 'workspace'` (fungsi murni di `centerAction.ts`; uji `npm run test:center`). `useAttendanceStatus()` → `{ action, center, badge, refresh, terapkan }`: sumbernya payload `state.center {action, badge, flipsAt}` dari `GET absensi/hari-ini` (satu timer ke `flipsAt`, tanpa polling; lencana "!" pada tombol Absen saat jam pulang − 60 menit). Panggil `refresh()` setelah check-in/out, atau `terapkan(data)` bila layar sudah memuat hari-ini sendiri (layar Absen). Berpindah tab (selain Absen) otomatis menyegarkan. Obrolan ⇄ Inbox: `user.features.chat === false` (belum ada di `UserProfile`; dibaca defensif, bawaan Obrolan aktif).

## Tablet, lipat, rotasi (spec 12 §4.10, keputusan pemilik 13 Okt 2026)

- **< 600 dp** kapsul tab bar · **≥ 600 dp** Rail 96 dp (tanpa ruang bawah: `TabBarSpaceProvider aktif={false}`) · **≥ 720 dp** Tugas & Obrolan dua panel · **≥ 1000 dp** Obrolan tiga kolom (thread di kolom ketiga; di bawahnya thread = panel geser di atas percakapan).
- Detail yang bisa ditanam ada di `src/features` (`tugas/DetailTugas`, `obrolan/Percakapan`, `obrolan/Thread`); rute `app/…` hanya pembungkus yang membaca parameter. Tugas terpilih disimpan di `?tugas=`.
- Orientasi: app.json tetap `portrait` (ponsel); `useKebijakanOrientasi()` (di `app/_layout.tsx`) membuka kunci bila sisi terpendek **layar** ≥ 600 dp dan mengunci potret lagi saat lipat ditutup. Ruang video sudah menyesuaikan lanskap sendiri.
- Layar stack (detail rapat, pengaturan, dsb.) tetap layar penuh tanpa Rail.

## Ikon

Hanya ikon yang terdaftar di `icons.ts` ikut paket. Menambah ikon:

1. Cari nama di https://lucide.dev (kebab-case).
2. Jalankan `node scripts/tambah-ikon.mjs nama-ikon` (menulis ulang `icons.ts`, impor per berkas; alias lama seperti `trash-2` otomatis menunjuk berkas kanoniknya).
3. Pakai `<Icon name="nama" />`. Padanan Ionicons lama ada di `ionicons-map.ts` (`<Ionicons name="…" />` dari `@/ui/Ionicons` masih bekerja untuk layar lama).

## Deviasi dari mockup

- **Kaca tanpa blur latar.** Android butuh `BlurTargetView` per layar; `Glass`/tab bar/sheet memakai latar tembus lebih pekat (0,82–0,94). Beri `blurTarget` pada `Glass` untuk blur sungguhan.
- **Haptics** belum ada (paket `expo-haptics` tidak termasuk daftar yang disetujui).
- Layar lama yang memakai `Text` RN langsung masih berfont sistem; komponen `@/ui` memakai Figtree.
- Lencana tab: angka Obrolan belum ada (API penanda-dibaca belum tersedia); Lainnya memakai titik, Inbox (saat Obrolan mati) memakai angka.
