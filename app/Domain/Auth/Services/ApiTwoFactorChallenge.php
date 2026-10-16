<?php

namespace App\Domain\Auth\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * The step between "password accepted" and "device token issued" for an
 * account with confirmed TOTP, in the mobile API (POST /auth/login →
 * POST /auth/dua-faktor).
 *
 * The challenge token is random, lives 5 minutes and is stored only as its
 * SHA-256 hash (cache key), together with the user id and the device that
 * signed in — whoever completes the challenge gets a token for exactly that
 * installation. It is single use (consume() pulls it atomically) and dies
 * after MAX_FAILURES wrong codes, so the 6-digit space cannot be walked.
 *
 * @phpstan-type Device array{platform: string, device_id_hash: string, name: string|null, os_version: string|null, app_version: string|null}
 * @phpstan-type Payload array{user_id: string, device: Device, password_change_required: bool, expires_at: int, failures: int}
 */
final class ApiTwoFactorChallenge
{
    public const int TTL_SECONDS = 300;

    public const int MAX_FAILURES = 5;

    /**
     * @param  Device  $device
     */
    public function issue(string $userId, array $device, bool $passwordChangeRequired): string
    {
        $token = Str::random(64);

        $this->put($token, [
            'user_id' => $userId,
            'device' => $device,
            'password_change_required' => $passwordChangeRequired,
            'expires_at' => time() + self::TTL_SECONDS,
            'failures' => 0,
        ]);

        return $token;
    }

    /**
     * @return Payload|null null when unknown, expired or already used
     */
    public function peek(string $token): ?array
    {
        /** @var Payload|null $payload */
        $payload = Cache::get($this->key($token));

        return is_array($payload) && $payload['expires_at'] > time() ? $payload : null;
    }

    /**
     * Claims the challenge (single use). Null when somebody else claimed it first.
     *
     * @return Payload|null
     */
    public function consume(string $token): ?array
    {
        /** @var Payload|null $payload */
        $payload = Cache::pull($this->key($token));

        return is_array($payload) && $payload['expires_at'] > time() ? $payload : null;
    }

    /**
     * Puts a consumed challenge back with its remaining lifetime (the device
     * registration failed after the code was already accepted).
     *
     * @param  Payload  $payload
     */
    public function restore(string $token, array $payload): void
    {
        $this->put($token, $payload);
    }

    /**
     * Counts a wrong code; the challenge is destroyed at the last allowed failure.
     * Returns whether the challenge is still alive.
     */
    public function recordFailure(string $token): bool
    {
        $payload = $this->peek($token);

        if ($payload === null) {
            return false;
        }

        $payload['failures']++;

        if ($payload['failures'] >= self::MAX_FAILURES) {
            Cache::forget($this->key($token));

            return false;
        }

        $this->put($token, $payload);

        return true;
    }

    /**
     * @param  Payload  $payload
     */
    private function put(string $token, array $payload): void
    {
        $remaining = $payload['expires_at'] - time();

        if ($remaining > 0) {
            Cache::put($this->key($token), $payload, $remaining);
        }
    }

    private function key(string $token): string
    {
        return 'api:2fa-challenge:'.hash('sha256', $token);
    }
}
