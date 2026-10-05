<?php

namespace App\Domain\Attendance\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * To HR (Sprint 10, UU PDP): an employee withdrew consent for location +
 * selfie processing, so GPS/selfie check-in is disabled for them until they
 * consent again — HR arranges another way to record attendance (QR kiosk or
 * manual correction).
 */
final class ConsentRevokedNotification extends BaseNotification
{
    public function __construct(public readonly User $employee) {}

    public function type(): NotificationType
    {
        return NotificationType::ConsentRevoked;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->employee->name} mencabut persetujuan data lokasi & selfie",
            body: 'Check-in GPS + selfie dinonaktifkan untuknya sampai ia menyetujui lagi. Atur cara absensi lain (kiosk QR atau koreksi manual).',
            url: '/absensi/hari-ini',
            actor: NotificationActor::fromUser($this->employee),
            meta: [
                'open_label' => 'Buka papan absensi',
                'context' => 'Privasi',
                'context_tone' => 'warning',
            ],
        );
    }
}
