<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Data\PasswordResetSession;
use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Services\PasswordResetExpiry;
use App\Models\PasswordResetRequest;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Status of the browser's "Lupa kata sandi" request, as shown on the waiting
 * page (polled every 5 seconds). Never reveals whether the address exists:
 *
 * - no row (unknown address) and a canceled row (replaced by a newer request
 *   elsewhere) both read `pending` until 24 hours after the request, then `expired`;
 * - `approved` issues a one-time setup token into this session (only the holder
 *   of the request token can get it), valid 30 minutes after the approval;
 * - `rejected` (with HR's reason) and `expired` are final.
 *
 * @phpstan-type Result array{status: 'pending'|'approved'|'rejected'|'expired', reason: string|null, session: PasswordResetSession}
 */
final readonly class CheckPasswordResetStatus
{
    public function __construct(private PasswordResetExpiry $expiry) {}

    /**
     * @return Result
     */
    public function handle(PasswordResetSession $session): array
    {
        return DB::transaction(function () use ($session): array {
            $request = PasswordResetRequest::query()
                ->where('request_token_hash', PasswordResetRequest::hashToken($session->token))
                ->lockForUpdate()
                ->first();

            $windowOver = ! $session->requestedAt->addHours(PasswordResetRequest::PENDING_HOURS)->isFuture();

            if ($request === null || $request->status === PasswordResetStatus::Canceled) {
                return $this->result($windowOver ? 'expired' : 'pending', $session->withSetupToken(null));
            }

            $this->expiry->expireIfDue($request);

            return match ($request->status) {
                PasswordResetStatus::Pending => $this->result('pending', $session),
                PasswordResetStatus::Approved => $this->result('approved', $this->ensureSetupToken($request, $session)),
                PasswordResetStatus::Rejected => $this->result('rejected', $session->withSetupToken(null), $request->reject_reason),
                // Used (finished in this or another tab) or expired: start over.
                default => $this->result('expired', $session->withSetupToken(null)),
            };
        });
    }

    private function ensureSetupToken(PasswordResetRequest $request, PasswordResetSession $session): PasswordResetSession
    {
        if ($session->setupToken !== null && $request->setup_token_hash !== null
            && hash_equals($request->setup_token_hash, PasswordResetRequest::hashToken($session->setupToken))) {
            return $session;
        }

        $token = Str::random(64);
        $request->forceFill([
            'setup_token_hash' => PasswordResetRequest::hashToken($token),
            'updated_at' => CarbonImmutable::now(),
        ])->save();

        return $session->withSetupToken($token);
    }

    /**
     * @param  'pending'|'approved'|'rejected'|'expired'  $status
     * @return Result
     */
    private function result(string $status, PasswordResetSession $session, ?string $reason = null): array
    {
        return ['status' => $status, 'reason' => $reason, 'session' => $session];
    }
}
