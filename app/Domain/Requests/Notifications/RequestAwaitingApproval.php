<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Requests\Support\RequestFormatter;
use App\Models\User;

/**
 * To the approver(s) of the step that just became active ("Perlu tindakan").
 */
final class RequestAwaitingApproval extends RequestNotification
{
    public function type(): NotificationType
    {
        return NotificationType::RequestSubmitted;
    }

    public function title(User $notifiable): string
    {
        $what = $this->request->leaveType->category->isProcurement()
            ? 'barang: '.((string) ($this->request->payload['item_name'] ?? $this->request->leaveType->name))
            : $this->request->leaveType->name;

        return "{$this->request->user->name} mengajukan {$what} · menunggu persetujuan Anda";
    }

    public function body(User $notifiable): string
    {
        return RequestFormatter::summary($this->request);
    }

    public function neutralTitle(User $notifiable): string
    {
        return "Pengajuan {$this->request->user->name} menunggu persetujuan Anda";
    }

    public function url(User $notifiable): string
    {
        return '/persetujuan/'.$this->request->id;
    }

    protected function actor(): User
    {
        return $this->request->user;
    }

    protected function meta(User $notifiable): array
    {
        return ['open_label' => 'Buka persetujuan'];
    }
}
