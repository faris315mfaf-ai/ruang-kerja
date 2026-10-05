<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Support\KioskActivationCode;

/**
 * Redeems the short pairing code typed on the unpaired kiosk screen — the
 * alternative to opening the activation link on the device. Same TTL and
 * single use as the link; redeeming it also invalidates the link. Attempt
 * limits live in the controller (per IP, before this runs).
 */
final class ActivateKioskWithCode
{
    public function __construct(private readonly PairKiosk $pair) {}

    /**
     * Returns null when the code is malformed, unknown, used, expired or the
     * kiosk is inactive.
     */
    public function handle(string $input): ?Kiosk
    {
        $code = KioskActivationCode::normalize($input);

        if ($code === null) {
            return null;
        }

        $kiosk = Kiosk::query()
            ->where('activation_code_hash', KioskActivationCode::hash($code))
            ->where('is_active', true)
            ->first();

        if ($kiosk === null || ! $kiosk->hasPendingActivation()) {
            return null;
        }

        return $this->pair->handle($kiosk, 'code');
    }
}
