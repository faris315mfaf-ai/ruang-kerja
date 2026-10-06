# Dashboard per peran SPKD

> Pratinjau Fase 3 · dibangun Agen E · rute `/peran/{dirut,direktur,hr,corsec,marketing,programming,implementer,analis}` · data contoh, tidak menyimpan apa pun. Indeks: [README](README.md).

## 1. Tujuan & masalah

Dashboard Fase 1 dibagi per **peran akses** (Saya, Kepala Divisi, HR, Portofolio Direksi). Di SPKD, pekerjaan harian tiap jabatan berbeda jauh: Direktur Utama memutuskan proyek, Sekretaris Perusahaan mendisposisi surat, Implementer memperbarui tiket klien, Analis menjalankan UAT. Paket desain `docs/ruangkerja-design/` punya **RoleDesk/RolePhone** (satu templat beranda per peran) dan layar tugas **P\*** (PDirutKeputusan, PDirekturSetuju, PHRCuti, PCorsecSurat, PMarketingReview, PProgBug, PImplTiket, PAnalisUAT). Pratinjau ini menguji:

- satu **templat beranda berbasis data**: sapaan, status, aksi utama + sekunder, 4 KPI, daftar kerja, batang progres, jadwal terdekat, panel samping;
- satu **alur interaktif per peran** yang dibuka dari aksi utama, di Sheet kanan 560 px (desktop/tablet) atau bottom sheet (ponsel).

## 2. Peran yang memakai

| Kunci | Jabatan (persona) | Aksi utama → alur |
|---|---|---|
| `dirut` | Direktur Utama (Hendra Wijaya) | Putuskan perpanjangan DEP → **keputusan proyek** (PDirutKeputusan) |
| `direktur` | Direktur Operasional & Teknologi (Agus Setiawan) | Setujui 4 item → **persetujuan beruntun** (PDirekturSetuju) |
| `hr` | HR (Hana Nuraini) | Tinjau cuti Sari → **tinjau cuti** (PHRCuti) |
| `corsec` | Sekretaris Perusahaan (Nadia Putri) | Disposisi surat → **disposisi** (PCorsecSurat) |
| `marketing` | Kadiv Branding & Marketing (Putri Ramadhani) | Review brosur tender → **review materi** (PMarketingReview) |
| `programming` | Kadiv Programming (Dimas Pratama) | Tangani bug kritis → **progres bug** (PProgBug) |
| `implementer` | Kadiv Implementer (Bayu Saputra) | Perbarui tiket P1 → **update tiket** (PImplTiket) |
| `analis` | Kadiv Analis (Maya Lestari) | Jalankan UAT SIMRS → **eksekusi UAT** (PAnalisUAT) |

Pratinjau tidak membatasi peran: siapa pun bisa berpindah peran lewat SegmentedTabs (desktop/tablet) atau ChipScroller (ponsel); URL ikut berganti. Persona di sini mengikuti desain RoleDesk (mis. Dimas = Kadiv Programming), berbeda dengan modul lain.

## 3. Layar

### Direktur Utama · `/peran/dirut` (masuk `direksi@demo.test`)

![Dashboard Direktur Utama, desktop terang](img/dashboard-peran/dirut-desktop.jpg)

![Dashboard Direktur Utama, desktop Malam](img/dashboard-peran/dirut-desktop-malam.jpg)

![Dashboard Direktur Utama, ponsel](img/dashboard-peran/dirut-ponsel.jpg)

![Sheet keputusan perpanjangan DEP (opsi A/B/C), desktop](img/dashboard-peran/dirut-keputusan-desktop.jpg)

![Bottom sheet keputusan, ponsel](img/dashboard-peran/dirut-keputusan-ponsel.jpg)

### Direktur · `/peran/direktur`

![Dashboard Direktur, desktop](img/dashboard-peran/direktur-desktop.jpg)

![Dashboard Direktur, ponsel](img/dashboard-peran/direktur-ponsel.jpg)

![Sheet persetujuan beruntun dengan Tolak/Setujui per item](img/dashboard-peran/direktur-setujui-desktop.jpg)

### HR · `/peran/hr` (masuk `hr@demo.test`)

![Dashboard HR, desktop terang](img/dashboard-peran/hr-desktop.jpg)

![Dashboard HR, desktop Malam](img/dashboard-peran/hr-desktop-malam.jpg)

![Dashboard HR, ponsel](img/dashboard-peran/hr-ponsel.jpg)

![Sheet tinjau cuti Sari: kalender Oktober dan pemeriksaan](img/dashboard-peran/hr-cuti-desktop.jpg)

![Tinjau cuti, ponsel](img/dashboard-peran/hr-cuti-ponsel.jpg)

### Sekretaris Perusahaan, Branding & Marketing

![Dashboard Sekretaris Perusahaan](img/dashboard-peran/corsec-desktop.jpg)

![Sheet disposisi surat: tujuan, instruksi, catatan](img/dashboard-peran/corsec-disposisi-desktop.jpg)

![Dashboard Branding & Marketing](img/dashboard-peran/marketing-desktop.jpg)

![Sheet review brosur dengan pin komentar](img/dashboard-peran/marketing-review-desktop.jpg)

### Programming, Implementer, Analis

![Dashboard Programming, desktop terang](img/dashboard-peran/programming-desktop.jpg)

![Dashboard Programming, desktop Malam](img/dashboard-peran/programming-desktop-malam.jpg)

![Dashboard Programming, ponsel](img/dashboard-peran/programming-ponsel.jpg)

![Sheet progres bug kritis (stepper)](img/dashboard-peran/programming-bug-desktop.jpg)

![Dashboard Implementer](img/dashboard-peran/implementer-desktop.jpg)

![Sheet update tiket P1](img/dashboard-peran/implementer-tiket-desktop.jpg)

![Dashboard Analis](img/dashboard-peran/analis-desktop.jpg)

![Sheet eksekusi skenario UAT](img/dashboard-peran/analis-uat-desktop.jpg)

## 4. Alur langkah demi langkah

1. `/peran/dirut` → pilih peran lain lewat tab/chip (URL berganti, mis. `/peran/hr`).
2. **Dirut:** "Putuskan perpanjangan DEP" (atau baris DEP) → pilih opsi A/B/C → "Putuskan opsi X" → toast + "Keputusan terkirim".
3. **Direktur:** "Setujui 4 item" → Setujui/Tolak per item, hitungan "N menunggu" turun, Urungkan (inline atau aksi di toast).
4. **HR:** "Tinjau cuti Sari" → kalender Okt + cek atasan/saldo/go-live/pengganti → **Setujui cuti**, atau **Tolak** → alasan wajib ≥ 5 karakter → Kirim penolakan.
5. **Corsec:** "Disposisi surat" → centang tujuan & instruksi, ubah catatan → "Kirim disposisi ke N tujuan" (nonaktif bila 0 tujuan).
6. **Marketing:** "Review brosur tender" → ketuk pin komentar 1–3, "Tandai selesai" → tombol "Setujui (N terbuka)" berubah "Setujui & kirim".
7. **Programming:** "Tangani bug kritis" → stepper maju (lolos staging → deploy → selesai, bisa diulang).
8. **Implementer:** "Perbarui tiket P1" → ganti status (radio), tambah foto → "Simpan update" menambah baris linimasa.
9. **Analis:** "Jalankan UAT SIMRS" → centang langkah → Lulus/Gagal → 148/200 & progres naik, skenario berikutnya.

Aksi sekunder (Ekspor PDF, Kalender konten, Kapasitas tim, Kehadiran langsung, Catat notulen, Check-in di klien, Review PR, Board sprint) baru berupa toast "tersedia saat modul aktif".

```mermaid
flowchart TD
    R[/peran/role/] -->|tab / chip peran| R
    R -->|aksi utama atau baris terkait| F{FlowSurface: Sheet 560 px / BottomSheet}
    F --> D1[Dirut: pilih opsi → Putuskan]
    F --> D2[Direktur: Setujui/Tolak per item → Urungkan]
    F --> D3[HR: cek cuti → Setujui / Tolak + alasan]
    F --> D4[Corsec: tujuan + instruksi → Kirim disposisi]
    F --> D5[Marketing: selesaikan pin → Setujui & kirim]
    F --> D6[Programming: stepper bug]
    F --> D7[Implementer: status + foto → Simpan update]
    F --> D8[Analis: langkah → Lulus/Gagal]
    D1 & D2 & D3 & D4 & D5 & D6 & D7 & D8 -->|useFakeMutation| T[Toast + state lokal]
    R -->|aksi sekunder| S[Toast 'tersedia saat modul aktif']
```

Alur backend nanti (contoh HR menyetujui cuti dari dashboard peran, memakai Action Fase 1):

```mermaid
sequenceDiagram
    actor H as HR
    participant W as Web (/peran/hr)
    participant L as Laravel
    participant DB as PostgreSQL
    participant N as Notifikasi
    H->>W: Setujui cuti
    W->>L: POST /persetujuan/{approval}/setujui
    L->>L: RequestApprovalPolicy, ApproveStep (Action Fase 1)
    L->>DB: request_approvals, requests, leave_balances, attendance_days (transaksi) + audit_logs
    L->>N: request.decided → pemohon
    L-->>W: props RoleDashboard diperbarui (antrean −1)
```

## 5. Penjelasan kode

| File | Peran |
|---|---|
| `pages/okr/role-dashboard.tsx` | Halaman (placeholder rute dibuat di folder `okr`). Menerima prop `role` dari rute (`whereIn` 8 kunci), memilih `RoleDashboardDesktop`/`RoleDashboardMobile`. Pemilihan peran memakai `router.get` dengan `preserveState`. |
| `features/role-dashboards/types.ts` | `RoleKey`, `RoleDashboard` (sapaan, status, `primaryAction`, `secondaryAction`, `flow`, `kpis`, `list`, `bars`, `schedule`, `side`, `phone`), `RoleKpi`, `RoleRow`, `RoleBar`, `RoleScheduleItem`, `RoleFlowKey`, serta data tiap alur (`DecisionFlow`, `ApprovalItem`, `LeaveReviewFlow`, `DispositionFlow`, `MaterialReviewFlow`, `BugFlow`, `TicketFlow`, `UatFlow`). |
| `features/role-dashboards/fixtures.ts` | `ROLE_DASHBOARDS` (satu config per peran, untuk desktop RoleDesk & ponsel RolePhone, disusun dengan helper `kpi()`, `row()`, `bar()`, `at()`, `tile()`), `DECISION_FLOW`, `APPROVAL_ITEMS`, `LEAVE_REVIEW_FLOW`, `DISPOSITION_FLOW`, `MATERIAL_REVIEW_FLOW`, `BUG_FLOW`, `TICKET_FLOW`, `UAT_FLOW`. |
| `features/role-dashboards/lib.ts` (+ `lib.test.ts`) | `isRoleKey`, `placeOf`, `pendingCount`, `uatTally`, `nextBugStep`, `toggleIndex`, `reviewButtonLabel`, `emptyDashboard`. |
| `role-dashboard.desktop.tsx`, `role-dashboard.mobile.tsx`, `role-picker.tsx`, `parts.tsx` | Templat beranda + pemilih peran. |
| `flows/surface.tsx` (`FlowSurface`, `FlowLabel`), `flows/index.tsx` (pemetaan `RoleFlowKey` → komponen), `flows/*-flow.tsx` | Delapan alur P\*. |

Keadaan pratinjau memakai `features/okr/preview.ts` + `preview-state.tsx` (`PreviewHeader`).

## 6. Bentuk data → tabel DATABASE.md

`RoleDashboard` adalah **proyeksi baca** dari data yang sebagian sudah ada; tidak ada tabel khusus.

| Panel | Sumber |
|---|---|
| KPI & daftar Dirut/Direktur | `workspaces` (proyek), `project_updates`, `milestones`, `request_approvals` |
| HR (hadir, terlambat, cuti, antrean) | `attendance_days`, `requests`, `request_approvals`, `leave_balances` |
| Programming (sprint, bug, PR) | `tasks` (+ label/kolom), integrasi Git **belum ada** |
| Jadwal terdekat | `calendar_events` (F2-3) |
| Corsec: surat & disposisi | **modul baru**: surat masuk, disposisi |
| Implementer: tiket klien | **modul baru**: tiket klien + linimasa |
| Analis: skenario UAT | **modul baru**: skenario & eksekusi UAT |
| Marketing: pipeline konten, prospek, review materi | **modul baru** atau workspace + label |

## 7. Pekerjaan backend tersisa

- [ ] **Keputusan pemilik:** apakah dashboard per jabatan menggantikan atau melengkapi dashboard Saya/Divisi/HR/Portofolio, dan pemetaan jabatan SPKD (dirut/direktur/corsec/divisi) ke peran global + divisi.
- [ ] Controller yang mengisi `RoleDashboard` dari data nyata (portofolio, persetujuan, absensi, pengajuan, tugas) dengan scope `visibleTo`, cache 5 menit seperti dashboard Fase 1.
- [ ] Alur P\* memanggil Action yang ada: `ApproveStep`/`RejectStep` (Direktur & HR), keputusan proyek (`project_updates.decision_resolved_*`) untuk Dirut.
- [ ] Modul baru bila disetujui: surat masuk & disposisi (Corsec), tiket klien (Implementer), skenario UAT (Analis), pipeline konten/prospek & review materi (Marketing); masing-masing dengan migrasi, Policy, Action, test.
- [ ] Policy rute `/peran/{role}`: hanya jabatan terkait (+ Direksi/Super Admin), bukan semua karyawan seperti di pratinjau.

## 8. Keadaan kosong/galat & aksesibilitas

- Menu "Keadaan" atau `?keadaan=memuat|kosong|galat` (`emptyDashboard()` mengosongkan daftar sambil mempertahankan sapaan). Catatan: berganti peran menghapus query `?keadaan`.
- Pemilih peran: SegmentedTabs (WAI-ARIA tabs, ←/→) di desktop, ChipScroller (radio) di ponsel.
- Sheet alur memakai Dialog Radix (fokus terjebak, Esc menutup); tombol utama nonaktif dengan alasan terlihat (mis. 0 tujuan disposisi).
- Badge selalu ikon/titik + teks; gradien hangat hanya untuk satu KPI per layar.

## 9. Batasan prototipe

- Hanya satu alur interaktif per peran; layar P\* kedua (PDirutPortofolio, PDirekturKapasitas, PHRLive, PCorsecNotulis, PMarketingKalender, PProgSprint, PImplCheckin, PAnalisReview) belum dibangun.
- Persona berbeda dengan modul lain (Dimas = Kadiv Programming di sini).
- Teks `PR #412` dsb. hanya di fixture `.ts` agar uji `color-tokens` tidak salah tangkap.
