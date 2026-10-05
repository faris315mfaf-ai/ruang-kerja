# Sprint 8 — Cara modul mengirim notifikasi (dan menambah hasil pencarian)

> Untuk agent/modul absensi, pengajuan, workspace, tugas, dashboard. Semua infrastruktur sudah ada; modul cukup menulis **satu kelas notifikasi** (dan opsional: satu provider pencarian / satu seksi ringkasan harian).

## 1. Registry

| Enum | Isi | Dipakai untuk |
|---|---|---|
| `App\Domain\Notifications\Enums\NotificationType` | jenis rinci: `task.assigned`, `mention`, `task.commented`, `task.due_soon`, `task.overdue`, `request.submitted`, `request.approved`, `request.rejected`, `request.revision_requested`, `attendance.check_in_reminder`, `attendance.check_out_reminder`, `system.announcement`, `system.test` | `notifications.type`, ikon & nada di Inbox, "Perlu tindakan" default |
| `App\Domain\Notifications\Enums\NotificationEvent` | baris matriks pengaturan (`notification_preferences.event`): `task.assigned`, `mention`, `task.commented`, `task.due_soon`, `task.overdue`, `request.pending`, `request.decided`, `attendance.check_in_reminder`, `attendance.check_out_reminder`, `system`, `digest.daily` | preferensi per kanal, kanal terkunci |
| `NotificationChannel` | `in_app` · `email` · `whatsapp` (F2, nonaktif) | |
| `NotificationCategory` | `task` · `request` · `attendance` · `system` | grup matriks & filter Inbox |

Beberapa type berbagi satu event (approved/rejected/revisi → `request.decided`). Default on/off per kanal ada di `config/notifications.php` (`defaults`). In-app untuk `request.pending` dan `system` **terkunci** (selalu aktif).

**Butuh jenis baru?** Tambah case di `NotificationType` (label, `event()`, `icon()`, `tone()`, `requiresAction()`); bila perlu baris pengaturan baru, tambah case di `NotificationEvent` (+ `label()`, `category()`) dan defaultnya di `config/notifications.php`. Ikon frontend: kunci di `resources/js/features/notifications/notification-icon.tsx`.

## 2. Menulis notifikasi

```php
namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\{NotificationActor, NotificationPayload, NotificationSubject};
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\{Request, User};

final class RequestSubmittedNotification extends BaseNotification
{
    public function __construct(public readonly Request $request) {}

    public function type(): NotificationType
    {
        return NotificationType::RequestSubmitted;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->request->user->name} mengajukan cuti 12–14 Okt",   // nama aktor & kode ditebalkan otomatis di UI
            body: '3 hari kerja · langkah 1/2',
            url: "/persetujuan/{$this->request->id}",                          // WAJIB path relatif ("/…")
            actor: NotificationActor::fromUser($this->request->user),
            subject: NotificationSubject::fromModel($this->request, $this->request->number, 'Cuti tahunan'),
            meta: ['open_label' => 'Buka persetujuan'],
        );
    }
}

// Kirim (di dalam transaksi pun aman: antre setelah commit)
$approver->notify(new RequestSubmittedNotification($request));
```

Yang otomatis dikerjakan `BaseNotification`:
- `via()` membaca `notification_preferences` (fallback `config/notifications.php`), kanal terkunci, WhatsApp hanya bila `NOTIFICATIONS_WHATSAPP_ENABLED=true`, **tahan saat cuti** (hanya Inbox) via kontrak `UserAvailability`.
- In-app = `InAppChannel` (tabel `notifications`, isi `subject_type/subject_id`, `action_required`) + `broadcast` ke `private-App.Models.User.{id}` (lonceng & toast realtime; fallback polling 30 dtk).
- Email bermerek (`resources/views/mail/notification.blade.php`), **ditunda** ke 07.00 WIB hari kerja berikutnya bila jam tenang aktif (`withDelay`).
- Antrean `ShouldQueueAfterCommit`.

Payload seragam (`data` jsonb, broadcast, API): `{type, title, body, url, actor{id,name,avatar}, subject{type,id,code,title}, meta}`. Kunci `meta` yang dipahami UI: `context` (teks pendek, mis. "lewat 1 hari kerja"), `context_tone` (`danger|warning|info|success`), `open_label` (label tombol), `quote` (bool, body tampil sebagai kutipan).

Penerima berupa `Collection`: `Notification::send($users, new X(...))`. Jangan menyebut isi yang tidak boleh dilihat penerima (mis. mention di workspace privat → cek akses dulu).

## 3. "Perlu tindakan"

Type dengan `requiresAction() === true` (`task.overdue`, `request.submitted`, `request.revision_requested`) muncul di tab **Perlu tindakan** dan seksi ringkasan harian sampai diselesaikan. Saat aksinya selesai (pengajuan diputus, tugas selesai, revisi dikirim):

```php
app(\App\Domain\Notifications\Actions\ResolveNotificationsForSubject::class)
    ->handle($request, NotificationType::RequestSubmitted);   // semua penerima, status baca tidak berubah
```
Override per notifikasi: `public function requiresAction(): bool` di kelas notifikasi.

## 4. Tanpa duplikat (job terjadwal)

```php
$history = app(\App\Domain\Notifications\Services\NotificationHistory::class);
if (! $history->wasSent($assignee, NotificationType::TaskDueSoon, $task, since: now()->subDay())) {
    $assignee->notify(new TaskDueSoonNotification($task));
}
```

## 5. Kontrak yang bisa di-bind modul

| Kontrak | Default | Diganti oleh |
|---|---|---|
| `Contracts\UserAvailability::isOnLeave($user, $at)` | `AlwaysAvailable` (false) | Pengajuan (cuti disetujui) |
| `Contracts\WorkdayCalendar::isWorkday($date)` | `WeekdayCalendar` (Sen–Jum) | Absensi (hari libur) |
| `Contracts\WhatsAppProvider::send($phone, $message)` | `NullWhatsAppProvider` | Fase 2 |

Bind di service provider modul: `$this->app->bind(UserAvailability::class, ApprovedLeaveAvailability::class);` (`NotificationServiceProvider` memakai `bindIf`, tidak menimpa).

## 6. Seksi ringkasan harian

Implementasikan `App\Domain\Notifications\Digest\Contracts\DigestSection::build(User $user, CarbonImmutable $date): ?DigestSectionData` dan tambahkan kelasnya (urutan tampil) di `config/notifications.php` → `digest.sections`. Kembalikan `null` bila kosong; ringkasan tanpa seksi tidak dikirim. Contoh bawaan: `Digest\Sections\InboxActionSection`.

```php
return new DigestSectionData(
    key: 'tasks.due_today', title: "Tenggat hari ini ({$count})", tileLabel: 'Tenggat hari ini', count: $count,
    items: [new DigestItem('Laporan mingguan operasional', code: 'OPS-145', trailing: '17.00')],
    tone: 'default',                // 'danger' untuk "Terlambat"
    note: 'Besok: PLQ-18 Finalisasi anggaran peluncuran',
    more: 'dan 1 tugas lainnya',
);
```
Mockup acuan tiga seksi: Tenggat hari ini (Tugas), Terlambat (Tugas, `danger`), Menunggu persetujuan Anda (Pengajuan, `avatarName` + `badge`). Setelah seksi persetujuan ada, `InboxActionSection` boleh dicabut dari config.

## 7. Detail di Inbox desktop (opsional)

Panel kanan menampilkan payload generik. Modul bisa mendaftarkan pratinjau kaya (React), mis. di `features/tasks/register-inbox.ts` yang di-import oleh halaman/fitur tugas:

```ts
import { registerNotificationDetail } from '@/features/notifications/detail-renderers';
registerNotificationDetail('task.', TaskNotificationPreview); // prefix, atau type persis: 'mention'
```

## 8. Pencarian (command palette ⌘K & /cari)

Implementasikan `App\Domain\Search\Contracts\SearchProvider` (`key()`, `label()`, `minQueryLength()`, `search(User $viewer, string $query, int $limit): list<SearchResult>`) lalu sisipkan kelasnya di `config/search.php` → `providers` sesuai urutan grup **Aksi · Tugas · Orang · Workspace · Dokumen**.

- Provider **wajib** hanya mengembalikan data yang boleh dilihat viewer (`visibleTo($viewer)` / Policy). Endpoint tidak memfilter lagi.
- Tugas: pakai full-text `search_vector`, kirim `code` (KEY-n), `snippet` (cuplikan deskripsi), `meta` ("Rizky Aditya · 4/7"), `icon` status.
- Dokumen Drive: `url` = webViewLink, `external: true`.
- Kunci ikon frontend: `resources/js/features/search/search-icon.tsx`.
- Aksi tambahan tanpa provider baru: `config/search.php` → `actions` (title, url/route, icon, keywords, roles, quick).

Bawaan: `ActionsSearchProvider` (navigasi + aksi cepat, difilter peran) dan `PeopleSearchProvider` (`User::visibleTo($viewer)->active()`, nama/email + jabatan · divisi).
