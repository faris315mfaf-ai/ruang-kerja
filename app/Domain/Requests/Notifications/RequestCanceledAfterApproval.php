<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Requests\Support\RequestFormatter;
use App\Models\EmployeeRequest;
use App\Models\User;

/**
 * HR canceled a request that was already approved (CancelApprovedRequest).
 *
 * - Requester (`request.voided`, preference "Pengajuan saya diputus"): the
 *   reason is shown in the app only; email/WhatsApp say "open the app".
 * - Approvers and the substitute (`request.canceled`): what was canceled and
 *   by whom, never the reason (it may describe the illness of a sick request).
 */
final class RequestCanceledAfterApproval extends RequestNotification
{
    public function __construct(
        EmployeeRequest $request,
        public readonly User $canceledBy,
        public readonly bool $toRequester,
    ) {
        parent::__construct($request);
    }

    public function type(): NotificationType
    {
        return $this->toRequester ? NotificationType::RequestVoided : NotificationType::RequestCanceled;
    }

    public function title(User $notifiable): string
    {
        $what = "{$this->request->leaveType->name} {$this->request->number}";

        return $this->toRequester
            ? "{$what} dibatalkan oleh {$this->canceledBy->name}"
            : "{$this->canceledBy->name} membatalkan {$what} milik {$this->request->user->name}";
    }

    public function body(User $notifiable): ?string
    {
        return $this->toRequester
            ? $this->request->cancel_reason
            : RequestFormatter::summary($this->request).' · sudah disetujui, kini dibatalkan.';
    }

    public function neutralTitle(User $notifiable): string
    {
        return $this->toRequester
            ? "Pengajuan Anda dibatalkan oleh {$this->canceledBy->name}"
            : "{$this->canceledBy->name} membatalkan pengajuan {$this->request->user->name}";
    }

    protected function noteInApp(): bool
    {
        return $this->toRequester;
    }

    public function url(User $notifiable): string
    {
        return $this->toRequester ? '/pengajuan/'.$this->request->id : '/persetujuan/'.$this->request->id;
    }

    protected function actor(): User
    {
        return $this->canceledBy;
    }

    protected function meta(User $notifiable): array
    {
        return $this->toRequester
            ? ['quote' => true, 'context' => 'Dibatalkan', 'context_tone' => 'danger']
            : ['context' => 'Dibatalkan', 'context_tone' => 'danger'];
    }
}
