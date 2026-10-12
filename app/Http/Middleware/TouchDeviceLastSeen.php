<?php

namespace App\Http\Middleware;

use App\Domain\Devices\Models\Device;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps devices.last_seen_at ("Perangkat saya", and the device-limit eviction
 * in RegisterDevice) current while an installation uses the API. Writes at
 * most once per THROTTLE_SECONDS per device with a conditional UPDATE, so
 * regular polling does not turn into one write per request.
 */
class TouchDeviceLastSeen
{
    public const int THROTTLE_SECONDS = 300;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();

        if ($user instanceof User && $response->isSuccessful()) {
            $this->touch($user);
        }

        return $response;
    }

    private function touch(User $user): void
    {
        $device = Device::forAccessToken($user);

        if ($device === null) {
            return;
        }

        $now = now();

        if ($device->last_seen_at !== null && $device->last_seen_at->gt($now->copy()->subSeconds(self::THROTTLE_SECONDS))) {
            return;
        }

        // Conditional so parallel requests write once; no updated_at bump.
        Device::query()
            ->whereKey($device->id)
            ->where(function ($query) use ($now): void {
                $query->whereNull('last_seen_at')
                    ->orWhere('last_seen_at', '<=', $now->copy()->subSeconds(self::THROTTLE_SECONDS));
            })
            ->toBase()
            ->update(['last_seen_at' => $now]);
    }
}
