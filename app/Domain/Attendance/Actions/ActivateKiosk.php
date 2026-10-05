<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Kiosk;

/**
 * Redeems an activation link: the device becomes this kiosk (PairKiosk), and
 * the pairing code issued with the link stops working too.
 */
final class ActivateKiosk
{
    public function __construct(private readonly PairKiosk $pair) {}

    /**
     * Returns null when the link is unknown, used, expired or the kiosk is inactive.
     */
    public function handle(string $token): ?Kiosk
    {
        $kiosk = self::findPending($token);

        return $kiosk === null ? null : $this->pair->handle($kiosk, 'link');
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
