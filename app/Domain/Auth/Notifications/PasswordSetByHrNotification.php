<?php

namespace App\Domain\Auth\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * To the employee whose password HR (or a Super Admin) just set, or that
 * `ruangkerja:reset-default-passwords --notify` returned to the company
 * default password (no actor). Never contains the password; HR hands it over
 * in person. If the employee did not expect it, they contact HR (account
 * takeover signal).
 */
final class PasswordSetByHrNotification extends BaseNotification
{
    public function __construct(
        public readonly ?User $actor,
        public readonly bool $mustChange,
        public readonly bool $toDefault = false,
    ) {}

    public function type(): NotificationType
    {
        return NotificationType::PasswordSetByHr;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $body = match (true) {
            $this->toDefault && $this->mustChange => 'Semua perangkat Anda sudah dikeluarkan. Masuk dengan kata sandi bawaan perusahaan (tanyakan ke HR), lalu ganti dengan kata sandi Anda sendiri.',
            $this->toDefault => 'Semua perangkat Anda sudah dikeluarkan. Masuk dengan kata sandi bawaan perusahaan (tanyakan ke HR).',
            $this->mustChange => 'Semua perangkat Anda sudah dikeluarkan. Masuk dengan kata sandi sementara dari HR, lalu ganti dengan kata sandi Anda sendiri.',
            default => 'Semua perangkat Anda sudah dikeluarkan. Masuk dengan kata sandi baru dari HR.',
        };

        return new NotificationPayload(
            title: $this->actor === null ? 'Kata sandi Anda dikembalikan ke sandi bawaan' : 'Kata sandi Anda diatur ulang oleh HR',
            body: $body.' Bila Anda tidak memintanya, segera hubungi HR.',
            url: '/settings/security',
            actor: $this->actor === null ? null : NotificationActor::fromUser($this->actor),
            meta: [
                'open_label' => 'Buka pengaturan keamanan',
                'context' => 'Keamanan akun',
                'context_tone' => 'warning',
            ],
        );
    }
}
