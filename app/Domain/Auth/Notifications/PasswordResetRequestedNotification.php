<?php

namespace App\Domain\Auth\Notifications;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * To HR (or, for a Super Admin's request, the other Super Admins): an employee
 * used "Lupa kata sandi" and is waiting on the screen for approval. "Perlu
 * tindakan" until approved, rejected or expired (ResolveNotificationsForSubject).
 */
final class PasswordResetRequestedNotification extends BaseNotification
{
    public function __construct(
        public readonly PasswordResetRequest $resetRequest,
        public readonly User $employee,
    ) {}

    public function type(): NotificationType
    {
        return NotificationType::PasswordResetRequested;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->employee->name} meminta reset kata sandi",
            body: 'Pastikan permintaan ini benar dari karyawan tersebut (mis. lewat telepon) sebelum menyetujui. Permintaan berlaku 24 jam.',
            url: "/admin/karyawan/{$this->employee->id}",
            actor: NotificationActor::fromUser($this->employee),
            subject: NotificationSubject::fromModel($this->resetRequest, null, 'Reset kata sandi'),
            meta: [
                'open_label' => 'Tinjau permintaan',
                'context' => 'Keamanan akun',
                'context_tone' => 'warning',
            ],
        );
    }

    protected function stillVisibleTo(User $notifiable): bool
    {
        $request = $this->resetRequest->fresh();

        return $request !== null
            && $request->status === PasswordResetStatus::Pending
            && Gate::forUser($notifiable)->allows('decide', $request);
    }
}
