<?php

namespace App\Domain\Auth\Services;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\PasswordResetRequest;
use App\Models\User;

/**
 * Closes an employee's pending / approved "Lupa kata sandi" requests when their
 * password is set some other way (HR, mass reset to the default password) and
 * resolves HR's "Perlu tindakan" items. Call inside the caller's transaction.
 */
final readonly class OpenPasswordResets
{
    public function __construct(private ResolveNotificationsForSubject $resolveNotifications) {}

    public function cancelFor(User $user): void
    {
        $open = PasswordResetRequest::query()
            ->where('user_id', $user->id)
            ->whereIn('status', [PasswordResetStatus::Pending->value, PasswordResetStatus::Approved->value])
            ->get();

        foreach ($open as $request) {
            $request->forceFill(['status' => PasswordResetStatus::Canceled, 'setup_token_hash' => null])->save();
            $this->resolveNotifications->handle($request, NotificationType::PasswordResetRequested);
        }
    }
}
