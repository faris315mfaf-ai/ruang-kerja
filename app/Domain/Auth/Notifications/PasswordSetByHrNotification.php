<?php

namespace App\Domain\Auth\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * To the employee whose password HR (or a Super Admin) just set. Never contains
 * the password; HR hands it over in person. If the employee did not expect it,
 * they contact HR (account takeover signal).
 */
final class PasswordSetByHrNotification extends BaseNotification
{
    public function __construct(
        public readonly User $actor,
        public readonly bool $mustChange,
    ) {}

    public function type(): NotificationType
    {
        return NotificationType::PasswordSetByHr;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $body = $this->mustChange
            ? 'Semua perangkat Anda sudah dikeluarkan. Masuk dengan kata sandi sementara dari HR, lalu ganti dengan kata sandi Anda sendiri.'
            : 'Semua perangkat Anda sudah dikeluarkan. Masuk dengan kata sandi baru dari HR.';

        return new NotificationPayload(
            title: 'Kata sandi Anda diatur ulang oleh HR',
            body: $body.' Bila Anda tidak memintanya, segera hubungi HR.',
            url: '/settings/security',
            actor: NotificationActor::fromUser($this->actor),
            meta: [
                'open_label' => 'Buka pengaturan keamanan',
                'context' => 'Keamanan akun',
                'context_tone' => 'warning',
            ],
        );
    }
}
