<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Requests\Support\RequestFormatter;
use App\Models\User;

/**
 * To the requester (final approval) and to the substitute named on a leave.
 */
final class RequestApproved extends RequestNotification
{
    public function kind(): string
    {
        return 'request.approved';
    }

    public function title(User $notifiable): string
    {
        if ($notifiable->id !== $this->request->user_id) {
            return "Anda menjadi pengganti {$this->request->user->name} selama {$this->request->leaveType->name}";
        }

        return "{$this->request->leaveType->name} {$this->request->number} disetujui";
    }

    public function body(User $notifiable): string
    {
        return RequestFormatter::summary($this->request);
    }

    public function url(User $notifiable): string
    {
        return $notifiable->id === $this->request->user_id ? '/pengajuan/'.$this->request->id : '/pengajuan';
    }
}
