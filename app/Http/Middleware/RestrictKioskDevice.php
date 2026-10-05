<?php

namespace App\Http\Middleware;

use App\Domain\Attendance\Models\Kiosk;
use Closure;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * A browser signed in as a kiosk (guard `kiosk`) may only open the kiosk
 * routes (`kiosk.*`). Anything else — dashboard, attendance, admin, login,
 * JSON endpoints — sends it back to its kiosk page (JSON: 403).
 *
 * Also ends the kiosk session when the kiosk was deactivated, deleted or
 * paired with another device (session marker ≠ kiosks.activated_at).
 */
class RestrictKioskDevice
{
    public const string SESSION_KEY = 'kiosk_activated_at';

    public function handle(Request $request, Closure $next): Response
    {
        $guard = Auth::guard('kiosk');

        if ($guard->id() === null) {
            return $next($request);
        }

        $kiosk = self::current();

        if ($kiosk === null || ! $this->stillPaired($request, $kiosk, $guard instanceof SessionGuard && $guard->viaRemember())) {
            $guard->logout();

            return $next($request);
        }

        if ($request->routeIs('kiosk.*')) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            abort(Response::HTTP_FORBIDDEN, 'Perangkat kiosk hanya dapat membuka halaman kiosk.');
        }

        return redirect()->route('kiosk.show', ['location' => $kiosk->office_location_id]);
    }

    /**
     * The kiosk signed in on this browser (not deleted), if any.
     */
    public static function current(): ?Kiosk
    {
        $id = Auth::guard('kiosk')->id();

        return $id === null ? null : Kiosk::query()->find($id);
    }

    public static function marker(Kiosk $kiosk): ?string
    {
        return $kiosk->activated_at?->utc()->toIso8601String();
    }

    private function stillPaired(Request $request, Kiosk $kiosk, bool $viaRemember): bool
    {
        $marker = self::marker($kiosk);

        if (! $kiosk->is_active || $marker === null || ! $request->hasSession()) {
            return false;
        }

        $session = $request->session();

        // Session expired and the guard signed in again from the remember cookie
        // (which is rotated on every pairing, so it belongs to the current one).
        if ($viaRemember && ! $session->has(self::SESSION_KEY)) {
            $session->put(self::SESSION_KEY, $marker);
        }

        return $session->get(self::SESSION_KEY) === $marker;
    }
}
