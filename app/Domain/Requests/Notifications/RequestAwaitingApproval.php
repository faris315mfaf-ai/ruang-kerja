<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Requests\Support\RequestFormatter;
use App\Models\User;

/**
 * To the approver(s) of the step that just became active.
 */
final class RequestAwaitingApproval extends RequestNotification
{
    public function kind(): string
    {
        return 'request.submitted';
    }

    public function title(User $notifiable): string
    {
        return "{$this->request->user->name} mengajukan {$this->request->leaveType->name} · menunggu persetujuan Anda";
    }

    public function body(User $notifiable): string
    {
        return RequestFormatter::summary($this->request);
    }

    public function url(User $notifiable): string
    {
        return '/persetujuan/'.$this->request->id;
    }
}
