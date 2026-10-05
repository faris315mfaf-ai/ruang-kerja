<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Support\KioskActivationCode;
use App\Domain\Organization\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Creates a single-use activation link for a kiosk device, plus a short
 * pairing code HR can type on the device instead (same expiry; redeeming
 * either one consumes both). Only hashes are stored; the plain link and code
 * are shown to HR once. Issuing again replaces the previous link and code.
 */
final class IssueKioskActivation
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @return array{token: string, code: string, expires_at: CarbonImmutable}
     */
    public function handle(Kiosk $kiosk): array
    {
        $token = Str::random(48);
        $code = $this->uniqueCode($kiosk);
        $expiresAt = CarbonImmutable::now()->addHours(config()->integer('attendance.qr.activation_ttl_hours'));

        $kiosk->forceFill([
            'activation_token_hash' => Kiosk::hashActivationToken($token),
            'activation_code_hash' => KioskActivationCode::hash((string) KioskActivationCode::normalize($code)),
            'activation_expires_at' => $expiresAt,
        ])->saveQuietly();

        $this->audit->log('kiosk.activation_issued', $kiosk, null, ['expires_at' => $expiresAt->toIso8601String()]);

        return ['token' => $token, 'code' => $code, 'expires_at' => $expiresAt];
    }

    /**
     * A code no other kiosk holds (the column is unique; collisions are
     * astronomically rare but would otherwise fail the insert).
     */
    private function uniqueCode(Kiosk $kiosk): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $code = KioskActivationCode::generate();
            $taken = Kiosk::withTrashed()
                ->whereKeyNot($kiosk->getKey())
                ->where('activation_code_hash', KioskActivationCode::hash((string) KioskActivationCode::normalize($code)))
                ->exists();

            if (! $taken) {
                return $code;
            }
        }

        throw new RuntimeException('Could not generate a unique kiosk activation code.');
    }
}
