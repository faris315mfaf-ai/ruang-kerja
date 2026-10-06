<?php

namespace App\Domain\Auth\Services;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\PasswordResetRequest;

/**
 * Marks a request `expired` once its window has passed: 24 hours without a
 * decision, or 30 minutes after approval without a new password. Used lazily
 * by the status check and by the daily ExpirePasswordResetRequests job; HR's
 * "Perlu tindakan" item is resolved at the same time.
 */
final readonly class PasswordResetExpiry
{
    public function __construct(private ResolveNotificationsForSubject $resolveNotifications) {}

    public function isDue(PasswordResetRequest $request): bool
    {
        return match ($request->status) {
            PasswordResetStatus::Pending => ! $request->expires_at->isFuture(),
            PasswordResetStatus::Approved => ! $request->canBeCompleted(),
            default => false,
        };
    }

    /**
     * @return bool whether the request was expired now
     */
    public function expireIfDue(PasswordResetRequest $request): bool
    {
        if (! $this->isDue($request)) {
            return false;
        }

        $request->forceFill(['status' => PasswordResetStatus::Expired, 'setup_token_hash' => null])->save();
        $this->resolveNotifications->handle($request, NotificationType::PasswordResetRequested);

        return true;
    }
}
