<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Kiosk;

/**
 * Soft-deletes a kiosk; its device is signed out on the next request (the
 * guard no longer finds the account). Displayed QR tokens keep their history.
 */
final class DeleteKiosk
{
    public function handle(Kiosk $kiosk): void
    {
        $kiosk->delete();
    }
}
