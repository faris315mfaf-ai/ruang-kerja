<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Services\PasswordResetExpiry;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * HR approves or rejects a "Lupa kata sandi" request (authorized by
 * PasswordResetRequestPolicy::decide). Approving lets the waiting browser set
 * a new password within 30 minutes; rejecting shows the reason there. Audited
 * on the employee (`user.password_reset_approved` / `_rejected`) and HR's
 * "Perlu tindakan" item is resolved for every recipient.
 */
final readonly class DecidePasswordReset
{
    public const string NOT_PENDING = 'Permintaan ini sudah diputus, dibatalkan, atau kedaluwarsa.';

    public const string INACTIVE = 'Akun karyawan ini tidak aktif, jadi kata sandinya tidak bisa direset.';

    public function __construct(
        private AuditLogger $audit,
        private PasswordResetExpiry $expiry,
        private ResolveNotificationsForSubject $resolveNotifications,
    ) {}

    /**
     * @param  string|null  $reason  required when rejecting
     *
     * @throws ValidationException
     */
    public function handle(User $actor, PasswordResetRequest $request, bool $approve, ?string $reason = null): PasswordResetRequest
    {
        // The refusal is thrown after the transaction so a lazy expiry is kept.
        $result = DB::transaction(function () use ($actor, $request, $approve, $reason): PasswordResetRequest|string {
            $locked = PasswordResetRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($this->expiry->expireIfDue($locked) || ! $locked->isAwaitingDecision()) {
                return self::NOT_PENDING;
            }

            $employee = $locked->user;

            if ($approve && ($employee === null || ! $employee->isActive())) {
                return self::INACTIVE;
            }

            $status = $approve ? PasswordResetStatus::Approved : PasswordResetStatus::Rejected;

            $locked->forceFill([
                'status' => $status,
                'decided_by' => $actor->id,
                'decided_at' => CarbonImmutable::now(),
                'reject_reason' => $approve ? null : $reason,
            ])->save();

            $this->audit->log(
                $approve ? 'user.password_reset_approved' : 'user.password_reset_rejected',
                $employee ?? $locked,
                ['status' => PasswordResetStatus::Pending->value],
                array_filter([
                    'status' => $status->value,
                    'request_id' => $locked->id,
                    'reason' => $approve ? null : $reason,
                ], fn ($value): bool => $value !== null),
                $actor,
            );

            $this->resolveNotifications->handle($locked, NotificationType::PasswordResetRequested);

            return $locked;
        });

        if (is_string($result)) {
            throw ValidationException::withMessages(['request' => $result]);
        }

        return $result;
    }
}
