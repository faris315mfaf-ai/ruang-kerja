# Tugas #2 — F2-3 Rapat, notulen & kalender (backend nyata)

> **Untuk:** Codex · **Disiapkan:** 6 Okt 2026 oleh Claude Code (integrator) · **Papan:** `docs/PEMBAGIAN-TUGAS.md` baris #2
> Baca dulu: `AGENTS.md` (terutama › Kerja paralel, › Serah terima antar agen), `docs/PRD.md` §6 (Google Calendar), `docs/DATABASE.md` §7, `docs/fitur/rapat-kalender.md` (alur pratinjau + gambar), `docs/sprints/sprint-8/HOW-TO-NOTIFY.md`, `docs/sprints/sprint-7/GOOGLE-API.md`.

## 0. Tujuan

Pratinjau Rapat & Kalender (`resources/js/features/meetings`, `resources/js/pages/meetings`) sudah lengkap tetapi seluruh datanya contoh (`fixtures.ts`, `useFakeMutation`). Ganti dengan backend sungguhan: rapat tersimpan, undangan & RSVP, notulen berversi dengan tindak lanjut yang menjadi tugas, kalender gabungan (rapat, tenggat, cuti, libur), dan sinkron Google Calendar + tautan Google Meet lewat job antrean (di-mock di test). Frontend dipertahankan; yang diganti sumber datanya.

**Selesai bila:** semua kriteria di §9 tercentang, test & lint hijau di worktree Codex, `docs/` diperbarui, status papan `review`.

## 1. Persiapan worktree (sekali)

Worktree Codex: `/Users/godam/PROYEK/ruang-kerja-codex` (situs `https://ruangkerja-codex.test`, database dev `ruangkerja_codex`, test `ruangkerja_testing_codex`). Branch tugas **berbasis `claude/f2-obrolan`** (branch lokal yang sama repo-nya) supaya mewarisi pola yang baru dibuat Claude: `EnsureFeatureEnabled`, `config/features.php`, notifikasi Obrolan, `scripts/ui-shots.mjs`.

```bash
cd /Users/godam/PROYEK/ruang-kerja-codex
git switch -c codex/f2-rapat claude/f2-obrolan
export PATH="$HOME/Library/Application Support/Herd/bin:$PATH"
composer install && npm ci && php artisan migrate --seed && npm run build
```

Bila `claude/f2-obrolan` bertambah commit, ambil dengan `git rebase claude/f2-obrolan` (setelah PR Obrolan masuk `main`: `git rebase main`). Jangan menjalankan dev server (Vite/Reverb) — lihat UI dengan `npm run build` + `E2E_BASE_URL=https://ruangkerja-codex.test node scripts/ui-shots.mjs …`.

Klaim tugas: ubah baris #2 di `docs/PEMBAGIAN-TUGAS.md` (Branch `codex/f2-rapat`, Status `dikerjakan`), isi `docs/sesi/codex.md` mengikuti templat `docs/sesi/README.md`, commit `docs: klaim tugas #2 F2-3 Rapat`.

## 2. Kepemilikan berkas

**Milik Codex (bebas ditulis):** `app/Domain/Meetings/**`, `app/Models/{Meeting,MeetingParticipant,MeetingAgendaItem,MeetingMinutes,MeetingMinutesVersion,MeetingActionItem,CalendarEvent}.php`, `app/Policies/Meeting*Policy.php`, `app/Http/Controllers/Meetings/**`, `app/Http/Requests/Meetings/**`, `app/Http/Resources/Meetings/**`, `app/Events/Meetings/**`, `app/Listeners/Meetings/**`, `app/Console/Commands/Meeting*`, `routes/meetings.php`, migrasi `database/migrations/2026_10_11_*`, `database/factories/Meeting*`, `database/seeders/MeetingDemoSeeder.php`, `tests/Feature/Meetings/**`, `resources/js/features/meetings/**`, `resources/js/pages/meetings/**`, seksi rapat di `docs/DATABASE.md` §7, `docs/fitur/rapat-kalender.md`, `docs/sesi/codex.md`, baris #2 papan.

**Berkas bersama — boleh diubah HANYA seperti ini (tambah, jangan ubah baris lain):**
| Berkas | Perubahan yang diizinkan |
|---|---|
| `config/features.php` | tambah `'meetings' => (bool) env('FEATURE_MEETINGS', env('APP_ENV', 'production') !== 'production'),` + komentar |
| `routes/web.php` | satu baris `require __DIR__.'/meetings.php';` setelah `chat.php` |
| `routes/prototype.php` | hapus blok `// F2-3 · Meetings…` (6 rute) dan ganti satu baris komentar seperti blok Obrolan |
| `app/Http/Middleware/HandleInertiaRequests.php` | tambah kunci `'meetings' => (bool) config('features.meetings')` di dalam array `features` |
| `resources/js/types/global.d.ts` | tambah `meetings: boolean` di tipe `features` |
| `app/Domain/Notifications/Enums/NotificationType.php`, `NotificationEvent.php`, `config/notifications.php` | tambah case di blok berkomentar `// Rapat (F2-3)` (lihat §6), lengkapi semua `match` |
| `database/seeders/DatabaseSeeder.php` | satu baris `$this->call(MeetingDemoSeeder::class);` setelah `ChatDemoSeeder` |
| `routes/channels.php` | (opsional) satu kanal `meeting.{meeting}` di akhir berkas |
| `tests/Feature/Performance/PageQueryCountTest.php` | satu test baru `it('keeps Rapat & Kalender free of N+1', …)` di akhir berkas |
| `tests/Feature/Prototype/PrototypeRoutesTest.php`, `tests/e2e/prototype-smoke.spec.ts` | hapus entri rute rapat/kalender |

**Jangan disentuh (integrator):** `resources/js/lib/navigation.ts`, `resources/js/pages/menu.tsx`, `resources/js/components/**`, `resources/js/features/prototype/**` (hub `/pratinjau`), `docs/CHANGELOG.md`, `docs/HANDOFF.md`, `AGENTS.md`, `composer.json`/`package.json`. Butuh tile Dock "Rapat", baris Menu, atau kartu hub dilepas → tulis di `docs/sesi/codex.md` › "Butuh dari integrator".

## 3. Skema (migrasi `2026_10_11_100100_create_meetings_tables.php`, bisa di-rollback; tulis juga di `docs/DATABASE.md` §7)

Konvensi: ULID, `timestampsTz`, CHECK lewat `DB::statement`, waktu UTC, tanggal kantor `Asia/Jakarta`.

- **`meetings`**: `id` ulid · `company_id` FK restrict · `workspace_id` FK null (nullOnDelete; rapat terkait workspace → "Jadikan tugas" memakai key-nya) · `title` varchar(160) · `description` text null · `starts_at`, `ends_at` timestamptz (CHECK `ends_at > starts_at`, durasi ≤ 12 jam divalidasi di aplikasi) · `platform` varchar(10) CHECK `meet|zoom|room|client` · `location` varchar(200) null (wajib untuk room/client) · `join_url` varchar(500) null (hanya https, untuk zoom) · `organizer_id` FK users · `minute_taker_id` FK users null · `recurrence` varchar(12) CHECK `none|weekdays|weekly|mon_wed_fri` · `series_id` ulid null (kemunculan berulang berbagi seri; buat kemunculan 8 minggu ke depan, bukan aturan RRULE) · `reminders` smallint[] default `{10}` · `leadership` bool default false · `canceled_at` null · timestamps · softDeletes. Indeks `(company_id, starts_at)`, `(organizer_id, starts_at)`, `(series_id)`.
- **`meeting_participants`**: `id` ulid · `meeting_id` FK cascade · `user_id` FK null (nullOnDelete) · `email` varchar(190) null (tamu eksternal; huruf kecil) · `rsvp` CHECK `accepted|tentative|declined|pending` default `pending` · `optional` bool · `responded_at` null · timestamps. CHECK `user_id IS NOT NULL OR email IS NOT NULL`; unik parsial `(meeting_id, user_id) WHERE user_id IS NOT NULL` dan `(meeting_id, email) WHERE email IS NOT NULL`. Penyelenggara selalu peserta `accepted`.
- **`meeting_agenda_items`**: `id`, `meeting_id` FK cascade, `position` smallint, `title` varchar(200), timestamps.
- **`meeting_minutes`** (1:1): `meeting_id` PK/FK cascade · `status` CHECK `draft|final` · `content` jsonb `{attendance: [{user_id, present, reason}], sections: [{title, body}], decisions: [string]}` · `updated_by` FK null · `finalized_at`, `finalized_by` null · timestamps. **Sengaja bukan tabel `notes`** (milik tugas #3 Catatan): notulen terstruktur; perbarui komentar di `features/meetings/types.ts` yang menyebut `notes`.
- **`meeting_minutes_versions`**: `id`, `meeting_id` FK cascade, `content` jsonb, `created_by` FK null, `created_at`. Disimpan saat konten berubah, paling banyak satu per 5 menit per penulis, dan selalu saat difinalkan.
- **`meeting_action_items`**: `id`, `meeting_id` FK cascade, `position`, `text` varchar(300), `assignee_id` FK users null, `due_date` date null, `task_id` FK tasks null (nullOnDelete; setelah "Jadikan tugas"), `done_at` null, timestamps.
- **`calendar_events`** (sudah dirancang di §7, buat sekarang): `id`, `google_event_id` varchar(255), `calendar_id` varchar(255), `source_type`/`source_id` (ulidMorphs; `Meeting` untuk tugas ini), `user_id` FK cascade (kalender milik siapa), `meet_link` varchar(255) null, `synced_at`, timestamps. Unik `(source_type, source_id, user_id)`.
- Dokumen terkait rapat memakai `attachments` (morph `Meeting`, `source = drive`) seperti pesan Obrolan (`App\Domain\Chat\Actions\AttachMessageFiles` sebagai pola).

## 4. Akses (Policy + scope, test matriks wajib)

`Meeting::visibleTo(User)` dan `MeetingPolicy` harus identik (contoh: `tests/Feature/Chat/ChatPolicyTest.php` › "lists exactly the channels the policy lets a user see"). Tersembunyi = **404**.
- **Lihat rapat + notulen:** penyelenggara, peserta internal, notulis; anggota workspace rapat (bila `workspace_id`) hanya melihat **judul & waktu** di kalender, bukan detail/notulen. Rapat `leadership = true` juga terlihat oleh pemegang `dashboard.view_company` (Direksi, HR, Super Admin) untuk `/manajemen/jadwal`. Tidak ada `Gate::before`.
- **Ubah/batalkan rapat, atur peserta:** penyelenggara. **RSVP:** peserta itu sendiri. **Tulis notulen:** notulis + penyelenggara; setelah final hanya bisa "Buka lagi" oleh mereka (dicatat di `audit_logs` sebagai `meeting.minutes_reopened`). **Jadikan tugas:** butuh `WorkspacePolicy::editTasks` pada workspace rapat; tanpa workspace rapat → tugas ke workspace pribadi penanggung jawab tidak boleh; tampilkan pesan "Pilih workspace rapat dulu".
- Kalender (`/kalender`) hanya berisi: rapat yang terlihat, tugas yang **ditugaskan ke penonton** (bertenggat), cuti **disetujui** milik penonton (Kepala Divisi: + anggota divisinya; HR/Direksi: tidak ditambah — kalender pribadi, bukan rekap), dan `holidays` perusahaan.
- Tamu eksternal (email) hanya menerima undangan Google Calendar; tidak pernah melihat apa pun di aplikasi.

## 5. Action, query, endpoint

**Actions (`app/Domain/Meetings/Actions`, satu `handle()`, transaksi):** `ScheduleMeeting` (validasi bentrok lunak → peringatan, bukan penolakan; buat seri berulang; penyelenggara peserta `accepted`; dispatch job sinkron Google; notifikasi undangan), `UpdateMeeting` (perubahan waktu → RSVP peserta lain kembali `pending` + notifikasi "Jadwal berubah"), `CancelMeeting` (satu kemunculan atau seluruh seri ke depan), `RespondToMeeting`, `SaveMinutes` (draf + versi), `FinalizeMinutes` (wajib: kehadiran terisi untuk semua peserta internal, ≥ 1 keputusan atau isi seksi, setiap tindak lanjut punya penanggung jawab & tenggat; kirim notifikasi ke peserta), `ReopenMinutes`, `ConvertActionItemsToTasks` (pakai `App\Domain\Tasks\Actions\CreateTask`; isi `task_id`; idempoten), `RemindActionItemOwners` (dedup per hari lewat `NotificationDispatchLog`), `ExportMinutesToGoogleDocs` (pakai `DocCreator` yang ada, sinkron dengan timeout 10 detik sesuai AGENTS.md; tanpa kredensial → 422 "Integrasi Google belum aktif").
**Queries (`app/Domain/Meetings/Queries`):** `MeetingAgenda` (hari ini / minggu ini, rapat berlangsung, notulen menunggu), `MeetingDetail`, `ScheduleConflicts` (peserta dengan rapat tumpang tindih atau cuti disetujui pada rentang itu), `CalendarFeed` (bulan/minggu, lapisan, tanpa N+1), `ManagementSchedule` (rapat leadership terdekat, notulen terbaru, tindak lanjut terbuka).
**Google (`app/Domain/Meetings/Jobs`, antrean, retry/backoff, selalu job):** `SyncMeetingToCalendar` (Calendar API `events.insert/patch/delete` di kalender penyelenggara lewat service account + domain-wide delegation; `conferenceData.createRequest` untuk platform `meet` → simpan `meet_link`), `RemoveMeetingFromCalendar`. Ikuti pola klien di `app/Domain/Google` (GoogleClientFactory). Scope baru `https://www.googleapis.com/auth/calendar.events` dicatat di `docs/sprints/sprint-7/GOOGLE-API.md`. Tanpa kredensial: rapat tetap tersimpan, `calendar_event` null, UI menampilkan "Tautan Meet dibuat setelah Google Calendar terhubung". Test memakai `Http::fake()` — **jangan pernah memanggil Google sungguhan**.
**Scheduler:** command `meetings:send-reminders` tiap menit (pengingat `reminders` menit sebelum mulai; klaim `NotificationDispatchLog` per peserta+kemunculan+menit) — daftarkan di `routes/console.php` (boleh: tambah satu baris).

**Rute (`routes/meetings.php`, middleware `EnsureFeatureEnabled::class.':meetings'`, `auth`, `verified`; ULID `whereUlid`):**
| Metode & rute | Fungsi |
|---|---|
| `GET /rapat` | Inertia `meetings/index` (agenda) |
| `GET /rapat/baru` | Inertia `meetings/create` (prop: orang perusahaan, workspace yang bisa diedit) |
| `POST /rapat` | jadwalkan → redirect `/rapat/{id}` |
| `GET /rapat/bentrok?peserta[]=&mulai=&selesai=` | JSON bentrok |
| `GET /rapat/{meeting}` · `PATCH` · `DELETE` | detail · ubah · batalkan (`?seri=1`) |
| `POST /rapat/{meeting}/kehadiran` | RSVP `{rsvp}` |
| `GET /rapat/{meeting}/notulen` · `PUT` | halaman notulen · simpan draf |
| `POST /rapat/{meeting}/notulen/final` · `/buka` · `/tugas` · `/ingatkan` · `/ekspor` | final · buka lagi · jadikan tugas `{item_ids}` · ingatkan · ekspor Docs |
| `GET /kalender?bulan=YYYY-MM&lapisan[]=` | Inertia `meetings/calendar` |
| `POST /kalender/sinkron` | antrekan sinkron ulang rapat penonton |
| `GET /manajemen/jadwal` | Inertia `meetings/management-schedule` (Gate `viewManagementDashboard`) |

FormRequest mengembalikan 404 sebelum validasi untuk rapat yang tidak terlihat (pola `App\Http\Requests\Chat\ChatRequest`). Pesan validasi Bahasa Indonesia. Limiter: pakai `throttle:messages` atau buat `meetings` (30/menit) di `AppServiceProvider` — kalau membuat baru, catat di sesi agar integrator tahu.

## 6. Notifikasi (kelas Notification + `via()` membaca preferensi)

Tambah di blok `// Rapat (F2-3)`: `NotificationType::MeetingInvited` (`meeting.invited`, "Undangan rapat"), `MeetingChanged` (`meeting.changed`, "Jadwal rapat berubah/dibatalkan"), `MeetingStarting` (`meeting.starting`, "Rapat segera dimulai"), `MeetingMinutesShared` (`meeting.minutes_shared`, "Notulen rapat"), `MeetingActionItem` (`meeting.action_item`, "Tindak lanjut rapat", `requiresAction` = true sampai selesai/jadi tugas → `ResolveNotificationsForSubject`). Semua memetakan ke **satu** `NotificationEvent::Meeting` (`meeting`, label "Rapat: undangan, pengingat & notulen", kategori `Task`), default `config/notifications.php`: in_app + email true, whatsapp false. Perbarui `tests/…/NotificationSettings…` yang memeriksa indeks baris matriks (lihat cara Claude menangani `chat.message`). URL notifikasi relatif (`/rapat/{id}`). Tidak pernah mengirim isi notulen ke email tamu eksternal.

## 7. Frontend

- Halaman menerima props server; hapus `fixtures.ts` dari runtime (pindahkan data yang masih berguna ke test), hapus `PrototypeBanner`/`usePreviewState`/`useDemoClock`; `useFakeMutation` → `router.post/put` Inertia atau `requestJson` (lihat `resources/js/features/chat` setelah Claude selesai, atau `features/tasks/detail/api.ts`). Pertahankan semua komponen & tata letak (desktop/tablet/ponsel, terang/malam) — yang berubah hanya sumber data & mutasi.
- Keadaan nyata: skeleton (props `Inertia::defer` untuk kalender bila berat), kosong (`EmptyState`), galat (toast + "Coba lagi"), "Belum tersinkron dengan Google Calendar".
- Pemberitahuan "Rapat dimulai" (`meeting-notice.tsx`): dipicu dari data `starts_at` rapat hari ini di klien (tanpa polling server), plus notifikasi `meeting.starting` dari server.
- Format tanggal/jam lewat `resources/js/lib/format.ts`; input jam di form tidak boleh mengikuti locale browser (temuan `BUG-REPORT.md`: tampil "03:00 PM") — pakai komponen pemilih jam sendiri atau `inputmode`/pola 24 jam.
- Tipe di `features/meetings/types.ts` disesuaikan dengan props server (`id` = ULID, bukan slug).

## 8. Data demo & test

- `MeetingDemoSeeder` (idempoten, tanpa notifikasi/job): adaptasi `fixtures.ts` ke akun demo (`kadiv@` Dimas = penyelenggara stand-up Operasional, rapat PLQ dengan Putri/Maya/Rizky, rapat leadership Direksi `direksi@`, notulen draf & final dengan tindak lanjut; satu tindak lanjut sudah menjadi tugas). Hari "sekarang" relatif terhadap `now()`.
- Test Pest wajib: matriks `MeetingPolicy` (peran × aksi, termasuk tamu, non-peserta satu workspace, Direksi untuk leadership vs non-leadership) + `visibleTo` identik; setiap Action; `ScheduleConflicts`; seri berulang & batalkan seri; notulen (validasi final, versi, buka lagi teraudit); `ConvertActionItemsToTasks` idempoten + izin `editTasks`; job Google dengan `Http::fake()` (insert dengan Meet, patch, delete, retry pada 429/500, tanpa kredensial = tidak dipanggil); notifikasi + dedup pengingat; rute flag mati → 404; tamu → login; `PageQueryCountTest` untuk `/rapat`, `/rapat/{id}`, `/rapat/{id}/notulen`, `/kalender` (tanpa N+1); seeder idempoten. Waktu dikunci dengan `$this->travelTo()`.
- Vitest untuk logika murni yang diubah (`lib.ts`), termasuk konversi props.

## 9. Kriteria selesai

- [ ] Klaim papan + `docs/sesi/codex.md` terisi dan diperbarui tiap langkah
- [ ] Migrasi + model + factory + `docs/DATABASE.md` §7 (seksi Rapat) — rollback teruji
- [ ] Policy + matriks test; tersembunyi = 404
- [ ] Action, query, job Google (mock), scheduler pengingat, notifikasi
- [ ] Rute di `routes/meetings.php` di balik `FEATURE_MEETINGS`; rute rapat dikeluarkan dari `routes/prototype.php`
- [ ] Frontend memakai data server, tanpa `fixtures.ts`/`PrototypeBanner` di runtime; desktop 1440, tablet 834, ponsel 390, terang & malam tanpa galat dan tanpa gulir horizontal (`node scripts/ui-shots.mjs /rapat /kalender /rapat/<id> /rapat/<id>/notulen /manajemen/jadwal --akun kadiv@demo.test`, juga `direksi@demo.test`)
- [ ] `composer test` · `composer lint` · `npm run typecheck` · `npm run lint` · `npm test` hijau di worktree Codex
- [ ] `docs/fitur/rapat-kalender.md` diperbarui (status backend, alur nyata, pekerjaan tersisa); permintaan ke integrator dicatat di sesi
- [ ] Commit per langkah (Conventional Commits, pesan Bahasa Indonesia, akhiri dengan baris `Co-Authored-By` sesuai agen); **jangan push** — beri tahu pengguna untuk membuka PR atau minta integrator
- [ ] Papan baris #2 → `review`

## 10. Bila ragu

Jangan menebak keputusan produk: tulis pertanyaannya di `docs/sesi/codex.md` › "Pertanyaan untuk pengguna" dan tanyakan pengguna. Contoh yang mungkin muncul: dukungan Zoom API (saat ini cukup tautan manual), batas peserta tamu eksternal, apakah anggota workspace boleh melihat detail rapat workspace. Default di brief ini berlaku sampai pengguna memutuskan lain.
