<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\Enums\NotificationType;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;

final class RequestRejected extends RequestNotification
{
    public function __construct(EmployeeRequest $request, public readonly RequestApproval $step)
    {
        parent::__construct($request);
    }

    public function type(): NotificationType
    {
        return NotificationType::RequestRejected;
    }

    public function title(User $notifiable): string
    {
        return "{$this->request->leaveType->name} {$this->request->number} ditolak oleh ".($this->step->approver->name ?? 'penyetuju');
    }

    public function body(User $notifiable): ?string
    {
        return $this->step->note;
    }

    public function url(User $notifiable): string
    {
        return '/pengajuan/'.$this->request->id;
    }

    protected function actor(): ?User
    {
        return $this->step->approver;
    }

    protected function meta(User $notifiable): array
    {
        return ['quote' => true];
    }
}
