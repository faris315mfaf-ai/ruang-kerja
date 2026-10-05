<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Organization\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Redeems an activation link: the device becomes this kiosk. Any device that
 * was paired before is signed out (new remember token + new activated_at).
 */
final class ActivateKiosk
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Returns null when the link is unknown, used, expired or the kiosk is inactive.
     */
    public function handle(string $token): ?Kiosk
    {
        $kiosk = self::findPending($token);

        if ($kiosk === null) {
            return null;
        }

        $kiosk->forceFill([
            'activation_token_hash' => null,
            'activation_expires_at' => null,
            // Microseconds dropped: the value is compared with the session marker.
            'activated_at' => CarbonImmutable::now()->startOfSecond(),
            'remember_token' => Str::random(60),
        ])->saveQuietly();

        $this->audit->log('kiosk.activated', $kiosk);

        return $kiosk;
    }

    public static function findPending(string $token): ?Kiosk
    {
        if ($token === '' || strlen($token) > 128) {
            return null;
        }

        $kiosk = Kiosk::query()
            ->with('officeLocation')
            ->where('activation_token_hash', Kiosk::hashActivationToken($token))
            ->where('is_active', true)
            ->first();

        return $kiosk !== null && $kiosk->hasPendingActivation() ? $kiosk : null;
    }
}
