<?php

namespace App\Http\Controllers\Kiosk;

use App\Domain\Attendance\Actions\ActivateKiosk;
use App\Http\Controllers\Controller;
use App\Http\Middleware\RestrictKioskDevice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pairs a browser with a kiosk through HR's single-use link. GET only shows a
 * confirmation (link previews must not consume the token); POST signs the
 * device in with the `kiosk` guard (remember cookie) and signs out any
 * employee session in this browser.
 */
class KioskActivationController extends Controller
{
    public function show(string $token): Response
    {
        $kiosk = ActivateKiosk::findPending($token);

        return Inertia::render('kiosk/activate', [
            'token' => $token,
            'kiosk' => $kiosk === null ? null : [
                'name' => $kiosk->name,
                'code' => $kiosk->code,
                'locationName' => $kiosk->officeLocation->name,
            ],
        ]);
    }

    public function store(Request $request, string $token, ActivateKiosk $activate): RedirectResponse
    {
        $kiosk = $activate->handle($token);

        if ($kiosk === null) {
            return redirect()->route('kiosk.activate.show', ['token' => $token]);
        }

        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
        }

        Auth::guard('kiosk')->login($kiosk, remember: true);
        $request->session()->regenerate();
        $request->session()->put(RestrictKioskDevice::SESSION_KEY, RestrictKioskDevice::marker($kiosk));

        return redirect()->route('kiosk.show', ['location' => $kiosk->office_location_id]);
    }
}
