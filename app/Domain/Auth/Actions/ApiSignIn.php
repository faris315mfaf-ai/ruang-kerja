<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Services\ApiTwoFactorChallenge;
use App\Domain\Devices\Actions\SignInDevice;
use App\Domain\Devices\Enums\DevicePlatform;
use App\Http\Presenters\ApiUserPresenter;
use App\Models\User;
use Illuminate\Auth\Events\Login;

/**
 * What happens after an employee's identity was established in the mobile API
 * (password accepted, or "Lupa kata sandi" finished): decides between a device
 * token, a TOTP challenge and a refusal, so POST /auth/login and
 * POST /auth/lupa-sandi/selesai answer identically.
 *
 * Outcome `{status, body}` (the controller only wraps it in JSON):
 * - 403 `password_change_required` — temporary password and the app did not
 *   say it can change it itself (`$allowForcedChange`);
 * - 403 `two_factor_setup_required` — Super Admin without confirmed TOTP
 *   (set it up on the web first);
 * - 200 `{two_factor_required, challenge_token, expires_in}` — confirmed TOTP:
 *   no token yet, POST /auth/dua-faktor finishes the sign-in;
 * - 200 `{token, user, password_change_required}` — the device token.
 *
 * @phpstan-type Device array{platform: string, device_id_hash: string, name: string|null, os_version: string|null, app_version: string|null}
 * @phpstan-type Outcome array{status: int, body: array<string, mixed>}
 */
final readonly class ApiSignIn
{
    public function __construct(
        private SignInDevice $signInDevice,
        private ApiTwoFactorChallenge $challenges,
        private ApiUserPresenter $presenter,
    ) {}

    /**
     * @param  Device  $device
     * @return Outcome
     */
    public function begin(User $user, array $device, bool $allowForcedChange): array
    {
        if ($user->password_change_required && ! $allowForcedChange) {
            return $this->blocked('password_change_required', 'Ganti kata sandi lewat web terlebih dahulu.');
        }

        if ($user->hasEnabledTwoFactorAuthentication()) {
            return [
                'status' => 200,
                'body' => [
                    'two_factor_required' => true,
                    'challenge_token' => $this->challenges->issue($user->id, $device, $user->password_change_required),
                    'expires_in' => ApiTwoFactorChallenge::TTL_SECONDS,
                ],
            ];
        }

        if ($user->isSuperAdmin()) {
            return $this->blocked('two_factor_setup_required', 'Aktifkan autentikasi dua faktor (TOTP) lewat web terlebih dahulu, lalu masuk lagi di aplikasi.');
        }

        return $this->issueToken($user, $device);
    }

    /**
     * Issues the device token (registers the installation, replaces its
     * previous token) and records the login like the web does.
     *
     * @param  Device  $device
     * @return Outcome
     */
    public function issueToken(User $user, array $device): array
    {
        ['token' => $token] = $this->signInDevice->handle(
            $user,
            DevicePlatform::from($device['platform']),
            $device['device_id_hash'],
            name: $device['name'],
            osVersion: $device['os_version'],
            appVersion: $device['app_version'],
        );

        // Same bookkeeping as the web login (Listeners\RecordLogin): stamps last_login_at.
        event(new Login('web', $user, false));

        return [
            'status' => 200,
            'body' => [
                'token' => $token,
                'user' => $this->presenter->concise($user),
                'password_change_required' => $user->password_change_required,
            ],
        ];
    }

    /**
     * @return Outcome
     */
    private function blocked(string $code, string $message): array
    {
        return ['status' => 403, 'body' => ['code' => $code, 'message' => $message]];
    }
}
