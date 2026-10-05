<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Requests\Support\RequestFormatter;
use App\Models\EmployeeRequest;
use App\Models\User;

/**
 * To the requester (final approval) and to the substitute named on a leave.
 */
final class RequestApproved extends RequestNotification
{
    public function __construct(EmployeeRequest $request, public readonly ?User $decidedBy = null)
    {
        parent::__construct($request);
    }

    public function type(): NotificationType
    {
        return NotificationType::RequestApproved;
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

    protected function actor(): ?User
    {
        return $this->decidedBy;
    }

    protected function meta(User $notifiable): array
    {
        return ['context' => 'Disetujui', 'context_tone' => 'success'];
    }
}
