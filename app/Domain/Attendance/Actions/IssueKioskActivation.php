<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Organization\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Creates a single-use activation link for a kiosk device. Only the SHA-256 of
 * the token is stored; the plain token is shown to HR once.
 */
final class IssueKioskActivation
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @return array{token: string, expires_at: CarbonImmutable}
     */
    public function handle(Kiosk $kiosk): array
    {
        $token = Str::random(48);
        $expiresAt = CarbonImmutable::now()->addHours(config()->integer('attendance.qr.activation_ttl_hours'));

        $kiosk->forceFill([
            'activation_token_hash' => Kiosk::hashActivationToken($token),
            'activation_expires_at' => $expiresAt,
        ])->saveQuietly();

        $this->audit->log('kiosk.activation_issued', $kiosk, null, ['expires_at' => $expiresAt->toIso8601String()]);

        return ['token' => $token, 'expires_at' => $expiresAt];
    }
}
