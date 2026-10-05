<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Kiosk;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Creates or updates a lobby kiosk. Deactivating it signs the device out on
 * its next request (RestrictKioskDevice) and voids its remember cookie.
 */
final class SaveKiosk
{
    /**
     * @param  array{name: string, code: string, office_location_id: string, is_active: bool}  $attributes
     */
    public function handle(User $actor, array $attributes, ?Kiosk $kiosk = null): Kiosk
    {
        $kiosk ??= new Kiosk(['company_id' => $actor->company_id]);
        $wasActive = $kiosk->exists && $kiosk->is_active;

        $kiosk->fill([
            ...$attributes,
            'name' => trim($attributes['name']),
            'code' => Str::upper(trim($attributes['code'])),
        ]);

        if ($wasActive && ! $kiosk->is_active) {
            $kiosk->remember_token = Str::random(60);
            $kiosk->activation_token_hash = null;
            $kiosk->activation_expires_at = null;
        }

        $kiosk->save();

        return $kiosk;
    }
}
