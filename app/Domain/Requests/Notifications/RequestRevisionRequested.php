<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\Enums\NotificationType;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;

/**
 * To the requester ("Perlu tindakan" until the revision is submitted).
 */
final class RequestRevisionRequested extends RequestNotification
{
    public function __construct(EmployeeRequest $request, public readonly RequestApproval $step)
    {
        parent::__construct($request);
    }

    public function type(): NotificationType
    {
        return NotificationType::RequestRevisionRequested;
    }

    public function title(User $notifiable): string
    {
        return ($this->step->approver->name ?? 'Penyetuju')." meminta revisi {$this->request->leaveType->name} {$this->request->number}";
    }

    public function body(User $notifiable): ?string
    {
        return $this->step->note;
    }

    public function neutralTitle(User $notifiable): string
    {
        return ($this->step->approver->name ?? 'Penyetuju').' meminta revisi pengajuan Anda';
    }

    protected function noteInApp(): bool
    {
        return true;
    }

    public function url(User $notifiable): string
    {
        return '/pengajuan/'.$this->request->id.'/ubah';
    }

    protected function actor(): ?User
    {
        return $this->step->approver;
    }

    protected function meta(User $notifiable): array
    {
        return ['quote' => true, 'open_label' => 'Revisi pengajuan'];
    }
}
