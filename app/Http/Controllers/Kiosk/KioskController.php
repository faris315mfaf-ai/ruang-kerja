<?php

namespace App\Http\Controllers\Kiosk;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Http\Controllers\Controller;
use App\Http\Middleware\RestrictKioskDevice;
use App\Http\Resources\Attendance\KioskScreen;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\Authenticated;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lobby kiosk screen `/kiosk/{location}` (docs/ARCHITECTURE.md §3.2): full
 * screen, QR rotating every 30 s, big clock, no navigation. Guard `kiosk`;
 * a kiosk may only open the page of its own location.
 */
class KioskController extends Controller
{
    public function show(OfficeLocation $location, #[Authenticated('kiosk')] Kiosk $kiosk, KioskScreen $screen): Response
    {
        self::authorizeLocation($kiosk, $location);

        $kiosk->loadMissing('company:id,name');

        return Inertia::render('kiosk/show', [
            'kiosk' => ['id' => $kiosk->id, 'name' => $kiosk->name, 'code' => $kiosk->code],
            'location' => ['id' => $location->id, 'name' => $location->name],
            'companyName' => $kiosk->company->name,
            'windowSeconds' => config()->integer('attendance.qr.window_seconds'),
            ...$screen->state($kiosk, CarbonImmutable::now()),
        ]);
    }

    /**
     * Polled by the kiosk page at every window boundary.
     */
    public function code(OfficeLocation $location, #[Authenticated('kiosk')] Kiosk $kiosk, KioskScreen $screen): JsonResponse
    {
        self::authorizeLocation($kiosk, $location);

        return response()->json($screen->state($kiosk, CarbonImmutable::now()))
            ->header('Cache-Control', 'no-store');
    }

    /**
     * `/kiosk`: devices that are not (or no longer) paired.
     */
    public function unpaired(): Response|RedirectResponse
    {
        $kiosk = RestrictKioskDevice::current();

        if ($kiosk !== null) {
            return redirect()->route('kiosk.show', ['location' => $kiosk->office_location_id]);
        }

        return Inertia::render('kiosk/unpaired');
    }

    private static function authorizeLocation(Kiosk $kiosk, OfficeLocation $location): void
    {
        abort_unless($kiosk->office_location_id === $location->id && $kiosk->company_id === $location->company_id, 403, 'Kiosk ini terdaftar untuk lokasi lain.');
    }
}
