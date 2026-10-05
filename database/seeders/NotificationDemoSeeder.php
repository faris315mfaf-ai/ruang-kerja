<?php

namespace Database\Seeders;

use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Models\InboxNotification;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Ramsey\Uuid\Uuid;

/**
 * Demo Inbox content (local/testing only, idempotent): a welcome notice for
 * every demo account plus the mockup "Inbox" set for Dimas (kadiv@demo.test).
 * Subjects of modules that are not built yet carry display codes only.
 * Rows are written directly (no email/broadcast), keyed by deterministic UUIDs.
 */
class NotificationDemoSeeder extends Seeder
{
    public function run(): void
    {
        $now = CarbonImmutable::now();

        foreach (DemoAccounts::emails() as $email) {
            $user = User::query()->where('email', $email)->first();

            if ($user === null) {
                continue;
            }

            $this->put($user, 'welcome', NotificationType::SystemAnnouncement, new NotificationPayload(
                title: 'Selamat datang di Inbox RuangKerja',
                body: 'Semua penugasan, sebutan, komentar, dan pengajuan Anda berkumpul di sini. Atur kanal yang Anda inginkan di Pengaturan › Notifikasi.',
                url: '/pengaturan/notifikasi',
                meta: ['open_label' => 'Atur notifikasi'],
            ), $now->subDays(2), read: true);
        }

        $dimas = User::query()->where('email', 'kadiv@demo.test')->first();

        if ($dimas === null) {
            return;
        }

        $actor = fn (string $email): ?NotificationActor => ($user = User::query()->where('email', $email)->first()) !== null
            ? NotificationActor::fromUser($user)
            : null;
        // Tasks seeded by WorkspaceSeeder are linked for real (Inbox preview, deep link to the detail).
        $task = function (string $code): ?Task {
            [$key, $number] = explode('-', $code) + [1 => '0'];
            $workspace = Workspace::query()->where('key', $key)->first();

            return $workspace === null ? null : Task::query()->where('workspace_id', $workspace->id)->where('number', (int) $number)->first();
        };
        $subject = function (string $type, string $code, string $title) use ($task): NotificationSubject {
            $model = $type === 'task' ? $task($code) : null;

            return $model !== null
                ? NotificationSubject::fromModel($model, $code, $title)
                : new NotificationSubject($type, '', $code, $title);
        };
        $taskUrl = fn (string $code): string => ($model = $task($code)) !== null ? '/w/'.explode('-', $code)[0].'/tasks/'.$model->number : '/tugas';

        $items = [
            ['mention', NotificationType::Mention, 18, new NotificationPayload(
                title: 'Sari Wulandari menyebut Anda di PLQ-15',
                body: '@Dimas Pratama mohon cek kutipan direksi di paragraf 2…',
                url: $taskUrl('PLQ-15'),
                actor: $actor('sari.wulandari@demo.test'),
                subject: $subject('task', 'PLQ-15', 'Siaran pers peluncuran'),
                meta: ['quote' => true, 'open_label' => 'Buka tugas'],
            )],
            ['leave', NotificationType::RequestSubmitted, 33, new NotificationPayload(
                title: 'Maya Lestari mengajukan cuti 12–14 Okt',
                body: '3 hari kerja · langkah 1/2',
                url: '/persetujuan',
                actor: $actor('maya.lestari@demo.test'),
                subject: $subject('request', 'CUT-2026-10-0014', 'Cuti tahunan'),
                meta: ['open_label' => 'Buka persetujuan'],
            )],
            ['overdue', NotificationType::TaskOverdue, 80, new NotificationPayload(
                title: 'OPS-127 melewati tenggat',
                body: null,
                url: $taskUrl('OPS-127'),
                subject: $subject('task', 'OPS-127', 'Verifikasi tagihan vendor logistik'),
                meta: ['context' => 'lewat 1 hari kerja', 'context_tone' => 'danger', 'open_label' => 'Buka tugas'],
            )],
            ['comment', NotificationType::TaskCommented, 82, new NotificationPayload(
                title: 'Rizky Aditya mengomentari PLQ-21',
                body: 'Checklist 4/7. Form pendaftaran & SEO menyusul Rabu.',
                url: $taskUrl('PLQ-21'),
                actor: $actor('anggota@demo.test'),
                subject: $subject('task', 'PLQ-21', 'Landing page produk baru'),
                meta: ['quote' => true, 'open_label' => 'Buka tugas'],
            )],
            ['assigned', NotificationType::TaskAssigned, 110, new NotificationPayload(
                title: 'Putri Ramadhani menugaskan PLQ-27 ke tim Anda',
                body: null,
                url: $taskUrl('PLQ-27'),
                actor: $actor('putri.ramadhani@demo.test'),
                subject: $subject('task', 'PLQ-27', 'Desain banner & spanduk peluncuran'),
                meta: ['open_label' => 'Buka tugas'],
            )],
            ['overtime', NotificationType::RequestSubmitted, 128, new NotificationPayload(
                title: 'Pengajuan lembur Yoga Pratama menunggu Anda',
                body: '3 Okt · 17.00–20.30',
                url: '/persetujuan',
                actor: $actor('yoga.pratama@demo.test'),
                subject: $subject('request', 'LBR-2026-10-0006', 'Lembur'),
                meta: ['open_label' => 'Buka persetujuan'],
            )],
            ['correction', NotificationType::RequestApproved, 60 * 17, new NotificationPayload(
                title: 'Hana Pratiwi menyetujui koreksi absensi Anda',
                body: 'check-out 1 Okt → 17.20',
                url: '/pengajuan',
                actor: $actor('hr@demo.test'),
                subject: $subject('request', 'KOR-2026-10-0001', 'Koreksi absensi'),
            ), true],
            ['reply', NotificationType::TaskCommented, 60 * 19, new NotificationPayload(
                title: 'Nadia Putri membalas di GDG-48',
                body: 'Stok rak C sudah dihitung ulang, selisih 3 unit.',
                url: $taskUrl('GDG-48'),
                actor: $actor('nadia.putri@demo.test'),
                subject: $subject('task', 'GDG-48', 'Laporan selisih stok rak C'),
                meta: ['quote' => true],
            ), true],
        ];

        foreach ($items as $item) {
            [$key, $type, $minutesAgo, $payload] = $item;
            $this->put($dimas, $key, $type, $payload, $now->subMinutes($minutesAgo), read: $item[4] ?? false);
        }
    }

    private function put(User $user, string $key, NotificationType $type, NotificationPayload $payload, CarbonImmutable $at, bool $read = false): void
    {
        InboxNotification::query()->firstOrCreate(
            ['id' => Uuid::uuid5(Uuid::NAMESPACE_URL, "ruangkerja:demo:{$user->email}:{$key}")->toString()],
            [
                'type' => $type->value,
                'notifiable_type' => $user->getMorphClass(),
                'notifiable_id' => $user->id,
                'data' => $payload->toArray($type),
                'action_required' => $type->requiresAction(),
                'read_at' => $read ? $at : null,
                'created_at' => $at,
                'updated_at' => $at,
            ],
        );
    }
}
