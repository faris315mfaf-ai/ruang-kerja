<?php

namespace App\Domain\Auth\Jobs;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Services\PasswordResetExpiry;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\PasswordResetRequest;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Hourly: expires "Lupa kata sandi" requests whose window passed (24 h without
 * a decision, 30 min after approval without a new password) so HR's "Perlu
 * tindakan" item disappears, and deletes closed requests after 90 days.
 */
final class ExpirePasswordResetRequests implements ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public const int RETENTION_DAYS = 90;

    public function handle(PasswordResetExpiry $expiry): void
    {
        $now = CarbonImmutable::now();

        PasswordResetRequest::query()
            ->where(fn ($query) => $query
                ->where(fn ($pending) => $pending->where('status', PasswordResetStatus::Pending->value)->where('expires_at', '<=', $now))
                ->orWhere(fn ($approved) => $approved->where('status', PasswordResetStatus::Approved->value)
                    ->where('decided_at', '<=', $now->subMinutes(PasswordResetRequest::SETUP_MINUTES))))
            ->orderBy('id')
            ->each(fn (PasswordResetRequest $request) => $expiry->expireIfDue($request));

        PasswordResetRequest::query()
            ->whereNotIn('status', [PasswordResetStatus::Pending->value, PasswordResetStatus::Approved->value])
            ->where('created_at', '<', $now->subDays(self::RETENTION_DAYS))
            ->delete();
    }
}
