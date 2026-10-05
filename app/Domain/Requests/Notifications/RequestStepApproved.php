<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Requests\Support\RequestFormatter;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;

/**
 * To the requester: one step approved, the request moves on.
 */
final class RequestStepApproved extends RequestNotification
{
    public function __construct(
        EmployeeRequest $request,
        public readonly RequestApproval $decided,
        public readonly RequestApproval $next,
    ) {
        parent::__construct($request);
    }

    public function type(): NotificationType
    {
        return NotificationType::RequestApproved;
    }

    public function title(User $notifiable): string
    {
        return sprintf(
            '%s %s disetujui %s, diteruskan ke %s',
            $this->request->leaveType->name,
            $this->request->number,
            $this->decided->approver->name ?? 'penyetuju',
            $this->next->approver->name ?? $this->next->stepLabel(),
        );
    }

    public function body(User $notifiable): string
    {
        return RequestFormatter::summary($this->request);
    }

    public function url(User $notifiable): string
    {
        return '/pengajuan/'.$this->request->id;
    }

    protected function actor(): ?User
    {
        return $this->decided->approver;
    }

    protected function meta(User $notifiable): array
    {
        return ['context' => 'langkah '.$this->decided->step_order.' disetujui', 'context_tone' => 'info'];
    }
}
