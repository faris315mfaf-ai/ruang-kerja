# Google Drive & Docs — API internal (Sprint 7 bagian A)

> Untuk agent/modul yang memakai Google Drive: workspace, tugas, komentar, pengajuan.
> Kode: `app/Domain/Google`, model `GoogleAccount`, `DriveFile`, `Attachment`, frontend `resources/js/features/drive`.
> Bagian B (penyambungan ke UI workspace/tugas) tinggal memanggil API di bawah.

## 1. Gambaran singkat

| Kebutuhan | Panggil | Sinkron? |
|---|---|---|
| Workspace (non-pribadi) dibuat | `CreateDriveFolder::dispatch($workspace)` | antrean |
| Anggota/peran berubah | `SyncDrivePermissions::dispatch($workspace)` | antrean |
| Nama workspace berubah | `CreateDriveFolder::dispatch($workspace)` (mengganti nama folder) | antrean |
| "Dokumen baru" (Docs/Sheets/Slides) | `CreateGoogleDoc::handle($workspace, GoogleDocType, $name, $user, $attachable?)` → `DriveFile` (`web_view_link`) | **sinkron**, timeout 10 dtk |
| "Unggah" (≤ 100 MB) | `QueueDriveUpload::handle($workspace, $uploadedFile, $user, $attachable?)` → `uploadId` | antrean (`UploadToDrive`) |
| "Pilih dari Drive" (Picker) | frontend `<DrivePicker onPicked>` → POST id → `AttachDriveFile::handle($user, $attachable, $workspaceId, $fileId)` | **sinkron**, timeout 10 dtk |
| Tab File (isi folder) | baca `DriveFile::visibleTo($user)->inFolder($folderId)`; bila `DriveFolderContentsSync::isStale($folderId)` → `SyncDriveFolderContents::dispatch($workspaceId, $folderId)` | antrean |
| Tab Dokumen | `DriveFile::visibleTo($user)->where('workspace_id', …)->documents()` | DB |
| Lepas lampiran | `RemoveAttachment::handle($attachment)` (soft delete, file Drive tetap) | DB |
| Pratinjau | `DriveFile::previewUrl()` / `<DriveFilePreview>` (iframe `…/preview`) | — |

Semua panggilan Google memakai **service account dengan domain-wide delegation** yang mengimpersonasi `GOOGLE_IMPERSONATE_USER`, kecuali Picker (token OAuth pengguna, scope `drive.file`).

## 2. Keputusan: klien Drive v3 tipis berbasis `Http` (bukan `google/apiclient`)

- RuangKerja hanya memakai ±14 endpoint Drive v3 (files get/list/create/update/delete, permissions list/create/update/delete, drives get, upload resumable). `App\Domain\Google\Http\HttpDriveClient` menulisnya langsung di atas `Illuminate\Support\Facades\Http`.
- **Mudah diuji:** `Http::fake()` langsung berlaku (apiclient memakai Guzzle sendiri sehingga perlu `MockHandler`), plus kontrak `DriveClient` yang punya `FakeDriveClient` lengkap.
- **Tanpa paket baru:** JWT service account (RS256) ditandatangani `openssl_sign`; OAuth pengguna memakai Socialite yang sudah ada. `google/apiclient` + `google/auth` + `phpseclib` menambah beberapa MB dan ratusan kelas walau `apiclient-services` dipangkas ke Drive saja.
- Konsekuensi: endpoint Google baru (mis. Calendar Fase 2) ditambahkan sebagai klien tipis serupa, atau saat itu apiclient bisa dipasang dengan `extra.google/apiclient-services: ["Drive", "Calendar"]`.

## 3. Konfigurasi (`config/google.php`)

| Env | Wajib untuk | Catatan |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Drive | path berkas kunci (mis. `secrets/google-sa.json`) **atau** isi JSON |
| `GOOGLE_IMPERSONATE_USER` | Drive | akun Workspace yang menjadi *Manager* Shared Drive |
| `GOOGLE_SHARED_DRIVE_ID` | Drive | Shared Drive "RuangKerja" |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth pengguna (Picker) & login | OAuth client "Web" yang sama dengan login |
| `GOOGLE_PICKER_API_KEY` | Picker | API key dibatasi ke Google Picker API + referrer domain aplikasi |
| `GOOGLE_PICKER_APP_ID` | opsional | nomor proyek Cloud; bawaan diambil dari awalan `GOOGLE_CLIENT_ID` |
| `GOOGLE_DRIVE_REDIRECT_URI` | opsional | bawaan `${APP_URL}/google/connect/callback` |
| `GOOGLE_ALLOWED_DOMAIN` | opsional | bila kosong dipakai `companies.google_domain` pengguna |
| `GOOGLE_PROTECTED_EMAILS` | opsional | email (pisah koma) yang izin langsungnya di folder tidak pernah dicabut |
| `GOOGLE_FAKE` | lokal/test | `true` = `FakeDriveClient` (diabaikan di produksi). Selalu `true` di `phpunit.xml` |

Retry, timeout, ukuran unggah: `google.retry.*` (6 percobaan, 10 dtk × 2^n, maks 900 dtk, jitter), `google.http.*` (job 30 dtk, sinkron 10 dtk, unggah per chunk 120 dtk), `google.upload.*` (100 MB, chunk 8 MiB, disk `local`, folder `drive-uploads`).

**Fitur nonaktif:** `GoogleFeatures::enabled()` (Drive), `oauthEnabled()`, `pickerEnabled()`, `missingDriveSettings()` (nama env saja, tanpa nilai). Saat nonaktif: job selesai tanpa aksi (log `google.job.skipped`), aksi sinkron melempar `GoogleNotConfigured` yang dirender sebagai toast/JSON `{"code":"google_not_configured","message":"Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja."}` (503). Halaman **Pengaturan › Akun Google** menampilkan kunci yang kurang hanya kepada Super Admin.

## 4. Menyambungkan Workspace (bagian B)

### 4.1 `Workspace implements HasDriveFolder`

```php
use App\Domain\Google\Contracts\HasDriveFolder;
use App\Domain\Google\Data\DriveMember;

class Workspace extends Model implements HasDriveFolder
{
    public function driveFolderKey(): string { return 'workspaces:'.$this->id; }   // tetap, ditulis ke appProperties.rk_owner
    public function driveFolderName(): string { return "{$this->name} [{$this->key}]"; }
    public function driveParentFolderId(): ?string { return null; }               // akar Shared Drive
    public function driveFolderId(): ?string { return $this->drive_folder_id; }
    public function storeDriveFolderId(?string $id): void { $this->forceFill(['drive_folder_id' => $id])->saveQuietly(); }
    public function driveWorkspaceId(): string { return $this->id; }

    /** @return list<DriveMember> owner/admin/member → writer, viewer → reader */
    public function driveMembers(): array
    {
        return $this->members()->with('user:id,email,status')->get()
            ->filter(fn ($m) => $m->user?->isActive())
            ->map(fn ($m) => DriveMember::forWorkspaceRole($m->user->email, $m->role->value))
            ->values()->all();
    }
}
```

Referensi implementasi lengkap yang dipakai test: `tests/Fixtures/Google/FolderOwner.php`. Job menyimpan model lewat `SerializesModels`, jadi pemilik folder **harus** model Eloquent.

### 4.2 Listener event Sprint 5

```php
// WorkspaceCreated (ShouldDispatchAfterCommit)
if (! $event->workspace->isPersonal()) {
    CreateDriveFolder::dispatch($event->workspace);
}

// WorkspaceMembersChanged — hanya bila folder sudah ada (pribadi dibuat saat pertama dipakai)
if ($event->workspace->drive_folder_id !== null) {
    SyncDrivePermissions::dispatch($event->workspace);
}
```

Workspace pribadi: folder dibuat otomatis saat pertama kali dipakai (`CreateGoogleDoc`, `QueueDriveUpload`/`UploadToDrive`, `SyncDrivePermissions` semuanya memanggil `DriveFolderService::ensure()` dan menjadwalkan sinkron izin bila folder baru).

### 4.3 Otorisasi: ikat `WorkspaceDriveAccess`

`DriveFilePolicy` dan `DriveFile::visibleTo()` bertanya ke kontrak `App\Domain\Google\Contracts\WorkspaceDriveAccess`. Bawaan `DenyWorkspaceDriveAccess` menolak semua (fail-closed). Di `WorkspaceServiceProvider::register()`:

```php
$this->app->singleton(WorkspaceDriveAccess::class, WorkspacePolicyDriveAccess::class);
// canView → WorkspacePolicy::canView, canContribute → canEditTasks, canManage → canManage,
// constrainVisible → $query->whereIn($column, Workspace::query()->visibleTo($user)->select('id'))
```

Ability yang tersedia:

| Policy | Ability | Pemakaian |
|---|---|---|
| `DriveFilePolicy` | `viewAny` | `Gate::authorize('viewAny', [DriveFile::class, $workspace->id])` (tab File/Dokumen) |
| | `view` | metadata satu file |
| | `create` | `Gate::authorize('create', [DriveFile::class, $workspace->id])` (unggah, dokumen baru, folder) |
| | `delete` | admin workspace, atau penambah file selama masih kontributor |
| `AttachmentPolicy` | `view` / `create` / `delete` | mengikuti `view`/`update` pada induk (task, komentar…); pengunggah boleh melepas lampirannya selama masih bisa melihat induk |
| `GoogleAccountPolicy` | `connect`, `usePicker`, `view`, `delete` | akun sendiri saja |

### 4.4 Lampiran di Task/Comment

Tambahkan relasi di model induk (tidak ada trait karena belum ada pemakai di bagian A):

```php
/** @return MorphMany<Attachment, $this> */
public function attachments(): MorphMany
{
    return $this->morphMany(Attachment::class, 'attachable')->latest();
}
```

Kirim ke frontend dengan `AttachmentResource::collection($task->attachments()->with(['driveFile', 'uploader:id,name'])->get())`.

### 4.5 Contoh controller (bagian B)

```php
// POST /workspace/{workspace}/dokumen
Gate::authorize('create', [DriveFile::class, $workspace->id]);
$file = $createGoogleDoc->handle($workspace, GoogleDocType::from($request->type), $request->name, $user, $task ?? null);
return back()->with(...)/Inertia::location($file->web_view_link);

// POST /tugas/{task}/lampiran/drive   body: { file_ids: string[] }  (dari DrivePicker)
Gate::authorize('create', [Attachment::class, $task]);
foreach ($request->file_ids as $id) { $attachDriveFile->handle($user, $task, $task->workspace_id, $id); }

// POST /tugas/{task}/lampiran/unggah   (FormRequest: 'file' => ['required', 'file', 'max:102400'])
$uploadId = $queueDriveUpload->handle($task->workspace, $request->file('file'), $user, $task);
```

`DriveFileUploaded` / `DriveUploadFailed` (berisi `uploadId`, `uploaderId`, pesan Indonesia) bisa dijadikan broadcast ke pengunggah untuk toast "File terunggah" dan menyegarkan tab File.

### 4.6 Komponen frontend (`resources/js/features/drive`)

| Komponen | Isi |
|---|---|
| `DrivePicker` | tombol "Pilih dari Drive": minta `/google/picker-token`, memuat `apis.google.com/js/api.js`, membuka Picker (My Drive + Shared Drives, multi-pilih). Bila belum/perlu hubungkan ulang → dialog "Hubungkan akun Google" (kembali ke halaman asal). Bila admin belum mengaktifkan → toast. `onPicked(files: PickedDriveFile[])`. |
| `DriveFileCard` | kartu lampiran (ikon jenis, nama, "Google Docs · Maya · 2 jam lalu"), tombol buka/lepas, tanda "Dihapus dari Drive". Target sentuh 44 px di ponsel. |
| `DriveFilePreview` | panel pratinjau iframe `…/preview` + detail + "Buka di Google Docs" + salin tautan. |
| `DriveFileIcon` | ikon berwarna token (Docs `info`, Sheets `success`, Slides `warning`, PDF `danger`). |
| `GoogleConnectionCard` | status sambungan + hubungkan/putuskan (dipakai `pages/settings/google.tsx`). |
| `drive-files.ts` | `previewUrl`, `kindFromMimeType`, `kindLabel`, `openLabel`, `formatFileSize`, `driveFileMeta`, `connectUrl`. |
| `types.ts` | `DriveFileData`, `AttachmentData`, `PickerTokenResponse`, `GoogleSettingsData`. |

CSP produksi (ARCHITECTURE §5) harus mengizinkan `apis.google.com`, `docs.google.com`, `drive.google.com` (script & frame).

## 5. Galat & retry

| Kejadian | Job | Aksi sinkron (UI) |
|---|---|---|
| Google belum dikonfigurasi | selesai tanpa aksi, log info | `GoogleNotConfigured` → toast / 503 |
| 429, 403 `rateLimitExceeded`/`userRateLimitExceeded`/`sharingRateLimitExceeded`/`dailyLimitExceeded`/`backendError`, 5xx, timeout | `release()` dengan backoff eksponensial (≥ `Retry-After`), gagal setelah 6 percobaan | `DriveRequestFailed` → "Google Drive sedang sibuk…" (429) |
| 404 folder workspace | `ensure()` membuat ulang folder (atau memulihkan folder yatim) lalu sinkron izin | "File atau folder tidak ditemukan…" |
| 404 saat mencabut izin | dianggap sudah dicabut | — |
| 400/403 lain (mis. email ditolak) saat sinkron izin | orang itu dilewati (`skipped`), yang lain lanjut | — |
| Sesi unggah kedaluwarsa | dianggap bisa diulang; percobaan berikut memulai sesi baru | — |
| Token pengguna dicabut (`invalid_grant`) | — | `refresh_token` dikosongkan; Picker meminta "Hubungkan ulang" |
| 401 dari Drive | token di-cache dibuang dan dicoba sekali lagi | — |

Log hanya berisi `operation`, `status`, `reason`, job, subjek (kunci pemilik / id folder), percobaan, dan hash email untuk izin yang dilewati — **tidak pernah** token, assertion JWT, kunci privat, atau URL sesi unggah. Payload `RevokeGoogleToken` dienkripsi (`ShouldBeEncrypted`); token service account di cache dienkripsi.

Idempotensi:
- **Folder:** id tersimpan diverifikasi → bila hilang, cari folder ber-`appProperties.rk_owner = <kunci>` (job yang mati sebelum menyimpan id) → baru buat. Kunci cache per pemilik mencegah dua worker membuat dua folder. `CreateDriveFolder` unik per pemilik saat antre.
- **Izin:** diff keadaan diinginkan vs izin langsung bertipe `user`; menjalankan dua kali tidak menulis apa pun. Tidak pernah menyentuh izin warisan Shared Drive, izin domain/grup/anyone, akun impersonasi, atau `GOOGLE_PROTECTED_EMAILS`. Peran `organizer`/`fileOrganizer` yang diberikan admin Drive tidak diturunkan. `SyncDrivePermissions` unik sampai diproses + `WithoutOverlapping` per pemilik.
- **Unggah:** URI sesi resumable disimpan (terenkripsi) per `uploadId`; percobaan ulang melanjutkan dari byte terakhir yang diakui Drive.

## 6. Menguji modul lain

`phpunit.xml` menyalakan `GOOGLE_FAKE=true`, jadi tidak ada test yang memanggil Google. Di test:

```php
use App\Domain\Google\Enums\DriveRole;
use App\Domain\Google\Testing\FakeDriveClient;

$drive = FakeDriveClient::fake();               // Drive palsu baru untuk test ini

$workspace = Workspace::factory()->create();    // + listener → CreateDriveFolder (queue sync)
$folder = $drive->assertFolderCreated("{$workspace->name} [{$workspace->key}]");
$drive->assertPermission($folder->id, 'rizky@demo.test', DriveRole::Writer);
$drive->assertNoPermission($folder->id, 'sari@demo.test');
$drive->assertFileCreated('Brief', 'application/vnd.google-apps.document', $folder->id);
$drive->assertCalled('permissions.create', 3);
$drive->assertNoWrites();                       // mis. setelah sinkron kedua
$drive->rateLimitNext('files.create_folder');   // injeksi galat: failNext($op, $status, $reason, $retryAfter, $times, $when)
```

Lainnya: `seedFolder()`, `seedFile()`, `seedPermission(..., inherited: true)`, `trash()`, `forget()`, `directAccess($folderId)`, `calls($op)`, `uploadedContent($fileId)`. Klien nyata diuji dengan `GoogleTesting::useRealServiceAccount()` + `Http::fake(GoogleTesting::tokenResponse() + [...])` (`tests/Fixtures/Google/GoogleTesting.php`). Policy dengan akses workspace tiruan: `tests/Fixtures/Google/StubWorkspaceDriveAccess.php`.

## 7. Tabel `google_accounts` (dibagi dengan login Google)

Pemilik migrasi: **Sprint 7** (`2026_10_05_230000_create_google_accounts_table`). Jangan membuat migrasi kedua.

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | ulid PK | |
| `user_id` | FK users, **unique**, cascade | satu akun Google per pengguna |
| `google_id` | varchar, indeks | `sub` Google |
| `email` | varchar(190) | email akun Google (huruf kecil) |
| `access_token` | text, cast `encrypted`, hidden | |
| `refresh_token` | text null, cast `encrypted`, hidden | `null` + kedaluwarsa = perlu hubungkan ulang |
| `expires_at` | timestamptz null | |
| `scopes` | `text[]` (default `{}`), cast `App\Casts\PostgresTextArray` | scope yang benar-benar disetujui |
| `created_at`, `updated_at` | timestamptz | |

Login Google (Sprint 1) menyimpan `users.google_id`, `avatar_url`, `last_login_at`. Bila login juga meminta `drive.file`, panggil `app(StoreGoogleAccount::class)->handle($user, $socialiteUser)` (memeriksa domain email **dan** klaim `hd` terhadap `companies.google_domain` / `GOOGLE_ALLOWED_DOMAIN`, menyimpan token terenkripsi, mempertahankan refresh token lama bila Google tidak mengirim yang baru).

Rute OAuth Drive (terpisah dari login): `GET /google/connect?return=/path` (`google.connect`), `GET /google/connect/callback` (`google.callback`), `DELETE /google/connect` (`google.disconnect`), `GET /google/picker-token` (`google.picker-token`, 30/menit), `GET /settings/google` (`settings.google`). Driver Socialite: `google-drive`. Parameter: `access_type=offline`, `include_granted_scopes=true` (incremental auth), `prompt=consent`, `login_hint`, `hd`.

## 8. Menyiapkan Google Cloud (pemilik produk)

1. **Google Cloud Console** → proyek → aktifkan **Google Drive API** dan **Google Picker API**.
2. **OAuth consent screen** → tipe **Internal**. Scope: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.file`.
3. **Credentials › OAuth client ID (Web)** → *Authorized redirect URIs*:
   - `https://<domain-app>/auth/google/callback` (login, Sprint 1)
   - `https://<domain-app>/google/connect/callback` (hubungkan Drive untuk Picker)
   - *Authorized JavaScript origins*: `https://<domain-app>` (Picker).
   Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`.
4. **Credentials › API key** → batasi ke *Google Picker API* dan *HTTP referrer* `https://<domain-app>/*` → `GOOGLE_PICKER_API_KEY`.
5. **Service account** → buat, unduh kunci JSON → simpan di server sebagai secret (lokal: `secrets/google-sa.json`, sudah di-ignore git) → `GOOGLE_SERVICE_ACCOUNT_JSON=<path lengkap>`. Catat **Client ID** (angka) service account.
6. **Admin Console** (admin.google.com) → Keamanan › Kontrol akses & data › **Kontrol API** › **Delegasi tingkat domain** → Tambahkan Client ID service account dengan scope `https://www.googleapis.com/auth/drive`.
7. **Google Drive** → buat **Shared Drive "RuangKerja"** → tambahkan akun impersonasi (mis. `admin-ruangkerja@perusahaan.co.id`, akun aktif di domain) sebagai **Pengelola (Manager)** → salin ID dari URL `drive.google.com/drive/folders/<ID>` → `GOOGLE_SHARED_DRIVE_ID`; isi `GOOGLE_IMPERSONATE_USER`.
8. Jalankan `php artisan config:clear && php artisan ruangkerja:google-check` (tambahkan `--write` untuk menguji membuat & menghapus folder uji). Perintah menampilkan ✓/✗ per langkah dengan petunjuk (delegasi belum diizinkan, akun bukan anggota Shared Drive, API belum aktif, dll.) tanpa mencetak rahasia.

**Lokal (SETUP-LOKAL §6):** Google OAuth tidak menerima redirect `.test`. Untuk menguji Picker/hubungkan akun: `php artisan serve --port=8000`, `APP_URL=http://localhost:8000`, daftarkan juga `http://localhost:8000/auth/google/callback` dan `http://localhost:8000/google/connect/callback` serta origin `http://localhost:8000`; kembalikan `APP_URL` setelahnya. Operasi Drive lewat service account (folder, izin, dokumen, unggah) **tidak** butuh redirect dan bisa diuji dari https://ruangkerja.test. Tanpa kredensial sama sekali, `GOOGLE_FAKE=true` menyalakan Drive palsu (disimpan di cache) agar UI bisa dicoba.

## 9. Batasan yang diketahui

- `drive_files.google_file_id` unik global (sesuai DATABASE.md): file yang sama dilampirkan di dua workspace memakai satu baris (workspace pertama). Lampiran tetap terlihat lewat otorisasi induknya.
- File hasil Picker dari My Drive pengguna **tidak** otomatis dibagikan ke anggota workspace; anggota lain bisa melihat metadata tetapi membuka file tergantung izin Drive pemiliknya. Opsi "Bagikan ke anggota workspace" diputuskan di bagian B.
- Belum ada uji ke Google sungguhan (tidak ada kredensial di lingkungan build). Jalankan `ruangkerja:google-check --write` setelah kredensial diisi.
