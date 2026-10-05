<?php

namespace App\Http\Controllers\Kiosk;

use App\Domain\Attendance\Actions\ActivateKiosk;
use App\Domain\Attendance\Actions\ActivateKioskWithCode;
use App\Domain\Attendance\Models\Kiosk;
use App\Http\Controllers\Controller;
use App\Http\Middleware\RestrictKioskDevice;
use App\Http\Requests\Attendance\KioskActivationCodeRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pairs a browser with a kiosk through HR's single-use link or the short
 * pairing code issued with it. Link: GET only shows a confirmation (link
 * previews must not consume the token), POST pairs. Code: typed on the
 * unpaired screen (/kiosk), limited per IP. Pairing signs the device in with
 * the `kiosk` guard (remember cookie) and signs out any employee session in
 * this browser.
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

        return $this->signIn($request, $kiosk);
    }

    public function redeemCode(KioskActivationCodeRequest $request, ActivateKioskWithCode $activate): RedirectResponse
    {
        $ip = (string) $request->ip();
        $attemptsKey = 'kiosk-code:attempts|'.$ip;
        $failuresKey = 'kiosk-code:failures|'.$ip;
        $maxFailures = config()->integer('attendance.qr.activation_code.max_failures');

        if (RateLimiter::tooManyAttempts($failuresKey, $maxFailures)) {
            throw $this->tooManyAttempts(RateLimiter::availableIn($failuresKey));
        }

        if (RateLimiter::tooManyAttempts($attemptsKey, config()->integer('attendance.qr.activation_code.attempts_per_minute'))) {
            throw $this->tooManyAttempts(RateLimiter::availableIn($attemptsKey));
        }

        RateLimiter::hit($attemptsKey, 60);

        $kiosk = $activate->handle($request->code());

        if ($kiosk === null) {
            RateLimiter::hit($failuresKey, config()->integer('attendance.qr.activation_code.lockout_minutes') * 60);

            throw ValidationException::withMessages([
                'code' => 'Kode aktivasi salah, sudah dipakai, atau kedaluwarsa. Minta HR membuat kode baru bila perlu.',
            ]);
        }

        RateLimiter::clear($failuresKey);

        return $this->signIn($request, $kiosk);
    }

    private function signIn(Request $request, Kiosk $kiosk): RedirectResponse
    {
        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
        }

        Auth::guard('kiosk')->login($kiosk, remember: true);
        $request->session()->regenerate();
        $request->session()->put(RestrictKioskDevice::SESSION_KEY, RestrictKioskDevice::marker($kiosk));

        return redirect()->route('kiosk.show', ['location' => $kiosk->office_location_id]);
    }

    private function tooManyAttempts(int $seconds): ValidationException
    {
        $wait = $seconds > 60 ? ceil($seconds / 60).' menit' : max(1, $seconds).' detik';

        return ValidationException::withMessages([
            'code' => "Terlalu banyak percobaan. Coba lagi dalam {$wait}.",
        ]);
    }
}
