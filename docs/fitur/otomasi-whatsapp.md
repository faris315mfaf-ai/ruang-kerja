# Otomasi, WhatsApp, tugas berulang, template & Kinerja saya (F2-4)

> **Status: Nyata** (Okt 2026, `FEATURE_AUTOMATION`) untuk `/otomasi`, `/otomasi/berulang`, `/otomasi/template`, `/kinerja` — data dari server, tersimpan. **WhatsApp ditahan**: `/pengaturan/whatsapp` tetap pratinjau data contoh. Indeks: [README](README.md).

## 1. Tujuan & masalah

| Bagian | Masalah | Solusi |
|---|---|---|
| **WhatsApp** | Notifikasi email sering tidak dibaca; karyawan hidup di WhatsApp (PRD §9 "adopsi rendah"). | Verifikasi nomor (OTP), opt-in per kejadian, jam tenang khusus WA, pratinjau template pesan. Provider (Meta Cloud API vs gateway) **belum diputuskan** (PRD §10 no. 2), jadi kanal tetap di balik antarmuka `NotificationChannel` (ADR #9). |
| **Aturan otomasi** | Langkah berulang manual: "kalau tugas pindah ke Review, kabari Kadiv". | Pembangun aturan *Jika → Dan → Maka* per workspace dengan log eksekusi. |
| **Tugas berulang** | Laporan mingguan/bulanan dibuat ulang tangan. | Pola Harian / Mingguan / Bulanan / Tiap N minggu dengan pratinjau 5 tanggal berikutnya. |
| **Template** | Struktur tugas & workspace proyek dibuat ulang tiap kali. | Template tugas (checklist, label, estimasi) dan template workspace (kolom status, label). |
| **Kinerja saya** | Karyawan tidak bisa melihat data dirinya sendiri (PRD §9 "merasa diawasi"). | Metrik output pribadi berdampingan, **tanpa skor gabungan** (ADR #8). |

## 2. Peran yang memakai

- **Semua karyawan**: WhatsApp (nomor sendiri), Kinerja saya.
- **Pemilik/admin workspace**: aturan otomasi, tugas berulang, template.
- **Super Admin**: memilih penyedia WhatsApp (panel "Layanan WhatsApp", info admin).

## 3. Layar

### WhatsApp · `/pengaturan/whatsapp`

Kartu sambungan (nomor → kode OTP → Terhubung), tabel kejadian dengan kolom In-app / Email / **WhatsApp**, jam tenang, pratinjau pesan (gelembung chat, sakelar "Tampilkan variabel" `{{1}}`), kirim pesan uji, putuskan sambungan, panel "Layanan WhatsApp".

![Pengaturan WhatsApp sebelum terhubung, desktop terang](img/otomasi-whatsapp/whatsapp-desktop.jpg)

![Pengaturan WhatsApp, desktop Malam](img/otomasi-whatsapp/whatsapp-desktop-malam.jpg)

![Pengaturan WhatsApp, ponsel](img/otomasi-whatsapp/whatsapp-ponsel.jpg)

![WhatsApp terhubung, kolom WhatsApp di tabel kejadian aktif](img/otomasi-whatsapp/whatsapp-terhubung-desktop.jpg)

### Aturan otomasi · `/otomasi`

KPI (aktif, eksekusi, gagal), daftar aturan dengan sakelar jeda/aktif, menu ⋯ (Lihat log, Duplikat, Hapus), log eksekusi.

![Daftar aturan otomasi, desktop terang](img/otomasi-whatsapp/aturan-desktop.jpg)

![Aturan otomasi, desktop Malam](img/otomasi-whatsapp/aturan-desktop-malam.jpg)

![Aturan otomasi, ponsel](img/otomasi-whatsapp/aturan-ponsel.jpg)

Pembangun aturan: nama, workspace, **Jika** (pindah ke kategori kolom / lewat tenggat / dibuat berlabel), **Dan** opsional (prioritas / penanggung jawab), **Maka** 1–3 aksi (beri tahu orang/peran/penanggung jawab/pengamat, tugaskan, tambah label, pindahkan kolom). Kalimat pratinjau berubah langsung.

![Dialog aturan baru, desktop](img/otomasi-whatsapp/aturan-baru-desktop.jpg)

![Bottom sheet aturan baru, ponsel](img/otomasi-whatsapp/aturan-baru-ponsel.jpg)

![Keadaan kosong aturan otomasi](img/otomasi-whatsapp/keadaan-kosong-desktop.jpg)

### Tugas berulang · `/otomasi/berulang`

Daftar dengan pola ("Setiap 2 minggu, hari Selasa dan Kamis"), penanggung jawab, jadwal berikutnya, jumlah dibuat; sakelar jeda; ⋯ Ubah / Buat sekarang / Hapus.

![Tugas berulang, desktop terang](img/otomasi-whatsapp/berulang-desktop.jpg)

![Tugas berulang, desktop Malam](img/otomasi-whatsapp/berulang-desktop-malam.jpg)

![Tugas berulang, ponsel](img/otomasi-whatsapp/berulang-ponsel.jpg)

![Dialog tugas berulang baru dengan pratinjau 5 tanggal berikutnya](img/otomasi-whatsapp/berulang-baru-desktop.jpg)

### Template · `/otomasi/template`

Tab Tugas / Workspace, kartu template dengan jumlah pemakaian, Pakai template, Template tugas baru.

![Template tugas, desktop terang](img/otomasi-whatsapp/template-desktop.jpg)

![Template, desktop Malam](img/otomasi-whatsapp/template-desktop-malam.jpg)

![Template, ponsel](img/otomasi-whatsapp/template-ponsel.jpg)

![Dialog pakai template tugas](img/otomasi-whatsapp/template-pakai-desktop.jpg)

### Kinerja saya · `/kinerja`

Filter 8 minggu / Bulan ini / Kuartal, empat metrik terpisah (tingkat penyelesaian, ketepatan waktu, lead time, kedisiplinan hadir) + Terlambat sekarang, definisi metrik (tooltip desktop + "Cara menghitung metrik"), grafik batang bertumpuk per minggu (tepat waktu vs lewat tenggat) dengan tabel `sr-only`, selesai per workspace, kehadiran bulan lalu, catatan privasi.

![Kinerja saya, desktop terang](img/otomasi-whatsapp/kinerja-desktop.jpg)

![Kinerja saya, desktop Malam](img/otomasi-whatsapp/kinerja-desktop-malam.jpg)

![Kinerja saya dengan KPI 2×2, ponsel](img/otomasi-whatsapp/kinerja-ponsel.jpg)

## 4. Alur langkah demi langkah

**WhatsApp**
1. `/pengaturan/whatsapp` → ketik `021-555` → **Kirim kode** → galat "Nomor ponsel diawali 08 atau +62 8."
2. Ketik `0812-3456-7890` → **Kirim kode** (toast, hitung mundur kirim ulang 60 detik).
3. Kode `111111` → "Kode salah. Sisa 2 percobaan." (3 kali salah = terkunci, minta kode baru). Kode `246810` → **Terhubung** (kode contoh sengaja ditampilkan di layar).
4. Nyalakan/matikan WhatsApp per kejadian → ubah jam tenang (Select per 30 menit; prioritas tinggi tetap dikirim) → pratinjau pesan → **Kirim pesan uji** → **Putuskan sambungan** (dialog konfirmasi).

**Aturan otomasi**
1. `/otomasi` → sakelar jeda/aktif → ⋯ Lihat log (log tersaring).
2. **Aturan baru** (dialog desktop / FAB + bottom sheet ponsel) → **Simpan** tanpa isian → galat per isian.
3. Isi Jika "Tugas pindah ke kolom kategori Review", Maka "Beri tahu Kepala Divisi" → kalimat pratinjau → Simpan. Aksi "pindahkan ke kolom" yang sama dengan pemicu ditolak (mencegah loop).

**Tugas berulang**: **Tugas berulang baru** → judul, workspace, penanggung jawab → pola (Harian hanya hari kerja / Mingguan pilih hari / Bulanan tanggal 1–31, 31 = akhir bulan / Tiap N minggu) → mulai & berakhir → pratinjau 5 tanggal berikutnya dari Sen 5 Okt 2026 → Simpan.

**Template**: tab Tugas → **Pakai template** → workspace, judul, tenggat, cek checklist & label → toast "Tugas OPS-131 dibuat". Tab Workspace → **Pakai template** → nama → kode diusulkan otomatis ("PPX") + validasi format/unik, visibilitas, pratinjau kolom status.

**Kinerja saya**: `/kinerja` → ganti periode → baca definisi metrik → grafik per minggu (tetap 8 minggu terakhir).

```mermaid
flowchart TD
    subgraph WA[WhatsApp]
        W1[Nomor] -->|Kirim kode| W2{Format valid?}
        W2 -->|tidak| W1
        W2 -->|ya| W3[Kode OTP] -->|salah ×3| W4[Terkunci · minta kode baru] --> W1
        W3 -->|246810| W5[Terhubung] --> W6[Opt-in per kejadian · jam tenang · uji]
        W5 -->|Putuskan + konfirmasi| W1
    end
    subgraph RU[Aturan otomasi]
        R1[/otomasi/] -->|Aturan baru| R2[Jika → Dan → Maka]
        R2 -->|Simpan| R3{Valid & tanpa loop?}
        R3 -->|tidak| R2
        R3 -->|ya| R1
        R1 -->|⋯ Lihat log| R4[Log eksekusi]
    end
    subgraph RT[Tugas berulang & template]
        T1[/otomasi/berulang/] -->|baru| T2[Pola + pratinjau 5 tanggal] --> T1
        T3[/otomasi/template/] -->|Pakai| T4[Tugas / workspace baru]
    end
```

Alur backend nanti (eksekusi aturan):

```mermaid
sequenceDiagram
    participant T as MoveTask (Action Fase 1)
    participant E as Event TaskMoved
    participant L as Listener RunAutomationRules
    participant DB as PostgreSQL
    participant N as Notification (via: in_app/email/whatsapp)
    T->>E: dispatch (task, dari, ke kategori)
    E->>L: queued
    L->>DB: automation_rules aktif di workspace + pemicu cocok
    L->>L: cek kondisi, kedalaman berantai ≤ batas
    L->>T: aksi move/assign/label (Action yang sama)
    L->>N: aksi notify → via() membaca notification_preferences
    L->>DB: automation_runs (success/failed/skipped)
```

## 5. Penjelasan kode

**Backend (nyata, `FEATURE_AUTOMATION`)**

| File | Peran |
|---|---|
| `routes/automation.php` | `/otomasi` (+ `aturan/*`), `/otomasi/berulang/*`, `/otomasi/template` (+ `tugas/*`, `workspace/*`), `/kinerja`, `/kinerja/{user}`. Flag mati → 404. |
| `app/Domain/Automation/Actions` | `RunAutomationRule` (menjalankan satu aturan pada satu tugas, mencatat run), `Save/Duplicate/Delete/SetAutomationRuleActive`, `Save/Delete/SetRecurringTaskActive`, `CreateTaskFromRecurring` (job & "Buat sekarang"), `Save/Delete/ApplyTaskTemplate`, `CreateWorkspaceFromTemplate`, `SaveWorkspaceAsTemplate`, `DeleteWorkspaceTemplate`. Aksi aturan memakai `UpdateTask` (tugaskan, label), `MoveTask` (pindah kolom) dan notifikasi `AutomationNotification` (`automation.notify`). |
| `app/Listeners/Automation/TriggerTaskAutomations` | `TaskMoved` (hanya bila **kategori** berubah, dicatat `TaskCategoryChanges` lewat `Task::updated`) dan `TaskCreated` → antrekan `RunTaskAutomations`. |
| `app/Domain/Automation/Jobs` | `RunTaskAutomations`, `RunOverdueAutomations` (07.05 WIB, sekali per tugas per tenggat), `CreateRecurringTasks` (07.00 WIB, idempoten lewat `recurring_task_occurrences`). |
| `app/Domain/Automation/Services` | `AutomationContext` (penjaga loop: maks. 3 aturan per rantai, aturan tidak memicu dirinya sendiri), `RecurrenceSchedule` (port `recurrence.ts`), `RuleMatcher`, `AutomationAccess`, `TemplateShapes`. |
| `app/Domain/Automation/Queries` | `AutomationPage` (KPI benar-benar 7 hari terakhir), `RecurringPage`, `TemplatesPage`, `PersonalPerformance` (Kinerja saya), `AutomationWorkspaces`. |
| `app/Policies` | `AutomationRulePolicy`, `AutomationRunPolicy`, `RecurringTaskPolicy`, `TaskTemplatePolicy`, `WorkspaceTemplatePolicy`, `PerformancePolicy` (gate `viewPerformance`, `AutomationServiceProvider`). |
| `database/seeders/AutomationDemoSeeder.php` | Data demo (4 aturan + log, 5 tugas berulang, 3 template tugas, 2 template workspace). |

**Frontend**

| File | Peran |
|---|---|
| `pages/automation/{rules,recurring,templates,performance}.tsx` | Halaman nyata: props dari controller, skeleton saat breakpoint belum diketahui. |
| `features/automation/mutation.ts` | `mutate()` = `router` Inertia + toast galat; controller menjawab redirect back + toast. Sakelar aktif/jeda optimistis dan kembali bila gagal. |
| `features/automation/confirm-delete.tsx` | Konfirmasi hapus aturan, tugas berulang, template. |
| `features/automation/save-workspace-template.tsx` | Kartu "Simpan sebagai template" di Pengaturan workspace (tim/proyek, owner/admin). |
| `rules.ts`, `recurrence.ts`, `performance.ts`, `helpers.ts` | Logika murni (kalimat aturan, validasi, jadwal, metrik). `recurrence-cases.json` = fixture bersama Vitest & Pest. |
| `whatsapp/*`, `fixtures.ts`, `preview-state.tsx` | **WhatsApp tetap pratinjau** (data contoh, banner "Ditahan"). |

## 6. Bentuk data → tabel DATABASE.md

| Tipe frontend | Tabel |
|---|---|
| `AutomationRule`, `RuleRun` | `automation_rules`, `automation_runs` |
| `RecurringTask` | `recurring_tasks` (+ `recurring_task_occurrences`) |
| `TaskTemplate`, `WorkspaceTemplate` | `task_templates`, `workspace_templates` |
| `PerformanceProps` | tanpa tabel baru: `tasks`, `task_assignees`, `attendance_days` (`MetricDefinitions`) |
| `WhatsappSettings` | **belum ada** (ditahan) |

Rincian kolom: `docs/DATABASE.md` §4 "Otomasi".

## 7. Status & cara pakai (Nyata, Okt 2026)

- **Aturan** — semua anggota workspace melihat aturan workspace-nya; **owner/admin** membuat, mengubah, menjeda, menduplikat, dan menghapus (dengan konfirmasi). Direksi/HR/Super Admin tidak melihat aturan workspace yang bukan miliknya. Pemicu: pindah ke kategori kolom, lewat tenggat (07.05 WIB), dibuat berlabel; kondisi prioritas/penanggung jawab; aksi beri tahu (aplikasi + email sesuai preferensi "Otomasi workspace"; penerima selalu disaring ke yang bisa melihat tugas), tugaskan, tambah label, pindah kolom. Log eksekusi 7 hari dengan hasil Berhasil/Gagal/Dilewati.
- **Tugas berulang** — anggota (bukan viewer) membuat; pembuat atau owner/admin mengubah, menjeda, "Buat sekarang", menghapus. Ada pilihan **prioritas**. Tugas dibuat 07.00 WIB, bertenggat hari itu, sekali per tanggal.
- **Template** — template tugas untuk semua workspace dibuat Kepala Divisi/Ketua Tim/Direksi/Super Admin; template khusus satu workspace oleh owner/admin-nya. "Pakai template" membuat tugas dengan checklist, label, estimasi (0,5–999 jam) dan **tenggat** yang dipilih. Template workspace disimpan dari Pengaturan workspace dan "Pakai template" **membuat workspace** (kolom + label template) lalu membukanya.
- **Kinerja saya** (`/kinerja`) — periode 8 minggu / Bulan ini / Kuartal (`?periode=`); grafik per minggu dan panel kehadiran mengikuti periode; tanpa skor gabungan. Atasan langsung dan HR membuka `/kinerja/{id}` (diaudit `performance.viewed`); workspace pribadi karyawan tidak ikut dan workspace yang tidak terlihat penonton disamarkan "Workspace lain".
- **Navigasi** — tile Otomasi & Kinerja saya di Dock/Rail (semua karyawan, flag menyala), baris di Menu ponsel.
- **Ditahan:** WhatsApp (`/pengaturan/whatsapp` tetap pratinjau berlabel "Ditahan", tidak ada aksi WhatsApp di aturan).

## 8. Keadaan kosong/galat & aksesibilitas

- Setiap layar punya keadaan kosong (EmptyState) yang menjelaskan siapa yang bisa menambah; galat validasi tampil per isian (pesan sama dengan server), galat lain sebagai toast.
- Grafik Kinerja punya tabel `sr-only`; metrik selalu angka + teks hitungan.
- Kontrol yang tidak boleh dipakai pengguna disembunyikan atau dinonaktifkan (sakelar aturan bagi anggota biasa).

## 9. Batasan

- Tanggal yang terlewat saat dijeda atau saat job tidak berjalan tidak disusulkan.
- Aturan "lewat tenggat" yang baru dibuat langsung berlaku untuk tugas yang sudah terlambat.
- Tautan "Kinerja saya" dari Beranda menunggu integrator (halaman Beranda sedang dirombak agen lain); sementara lewat Dock/Rail/Menu.
