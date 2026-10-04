<?php

namespace App\Domain\Requests\Notifications;

use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;

final class RequestRevisionRequested extends RequestNotification
{
    public function __construct(EmployeeRequest $request, public readonly RequestApproval $step)
    {
        parent::__construct($request);
    }

    public function kind(): string
    {
        return 'request.revision_requested';
    }

    public function title(User $notifiable): string
    {
        return ($this->step->approver->name ?? 'Penyetuju')." meminta revisi {$this->request->leaveType->name} {$this->request->number}";
    }

    public function body(User $notifiable): ?string
    {
        return $this->step->note === null ? null : '"'.$this->step->note.'"';
    }

    public function url(User $notifiable): string
    {
        return '/pengajuan/'.$this->request->id.'/ubah';
    }
}
