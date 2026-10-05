<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Requests\Support\RequestFormatter;
use App\Models\User;

/**
 * To the approver(s) who were waiting on a request the requester canceled.
 */
final class RequestCanceled extends RequestNotification
{
    public function type(): NotificationType
    {
        return NotificationType::RequestCanceled;
    }

    public function title(User $notifiable): string
    {
        return "{$this->request->user->name} membatalkan {$this->request->leaveType->name} {$this->request->number}";
    }

    public function body(User $notifiable): string
    {
        return RequestFormatter::summary($this->request);
    }

    public function url(User $notifiable): string
    {
        return '/persetujuan?tab=diputus';
    }

    protected function actor(): User
    {
        return $this->request->user;
    }
}
