<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Organization\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Makes the requesting device the kiosk, after its activation link or code
 * was verified. Both the link and the code are consumed (issued together, one
 * use in total). Any device that was paired before is signed out (new
 * remember token + new activated_at).
 */
final class PairKiosk
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  'link'|'code'  $via
     */
    public function handle(Kiosk $kiosk, string $via): Kiosk
    {
        $kiosk->forceFill([
            'activation_token_hash' => null,
            'activation_code_hash' => null,
            'activation_expires_at' => null,
            // Microseconds dropped: the value is compared with the session marker.
            'activated_at' => CarbonImmutable::now()->startOfSecond(),
            'remember_token' => Str::random(60),
        ])->saveQuietly();

        $this->audit->log('kiosk.activated', $kiosk, null, ['via' => $via]);

        return $kiosk;
    }
}
