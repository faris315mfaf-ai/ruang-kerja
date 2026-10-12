<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Auth\Actions\AuthenticateEmployee;
use App\Domain\Devices\Actions\SignInDevice;
use App\Domain\Devices\Models\Device;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Laravel\Fortify\LoginRateLimiter;

/**
 * Authentication for the mobile app (POST /api/v1/auth/*). Credentials are
 * verified by the web mechanism (AuthenticateEmployee: constant-time check,
 * generic error, audited failures), then the installation is registered and
 * receives a Sanctum token — one active token per installation
 * (Device::sanctumTokenName): re-login replaces the previous token.
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly AuthenticateEmployee $authenticate,
        private readonly SignInDevice $signInDevice,
        private readonly LoginRateLimiter $limiter,
    ) {}

    /**
     * Sign in and issue the device token.
     *
     * Blocked accounts answer 403 with a machine-readable `code`:
     * `password_change_required` (temporary HR password — change it on the web)
     * and `two_factor_required` (Super Admin needs TOTP, not yet supported here).
     */
    public function store(LoginRequest $request): JsonResponse
    {
        // Same per-email+IP lockout as the web login (Fortify's limiter, which
        // AuthenticateEmployee increments on every failed attempt).
        if ($this->limiter->tooManyAttempts($request)) {
            return response()->json([
                'message' => sprintf('Terlalu banyak percobaan masuk. Coba lagi dalam %d detik.', max(1, $this->limiter->availableIn($request))),
            ], 429);
        }

        $user = $this->authenticate->handle($request);

        if ($user->password_change_required) {
            return $this->blocked('password_change_required', 'Ganti kata sandi lewat web terlebih dahulu.');
        }

        if ($user->isSuperAdmin()) {
            return $this->blocked('two_factor_required', 'Akun Super Admin harus masuk lewat web untuk saat ini (autentikasi dua faktor belum didukung aplikasi).');
        }

        ['token' => $token] = $this->signInDevice->handle(
            $user,
            $request->platform(),
            $request->deviceIdHash(),
            name: $request->deviceName(),
            osVersion: $request->osVersion(),
            appVersion: $request->appVersion(),
        );

        $this->limiter->clear($request);

        // Same bookkeeping as the web login (Listeners\RecordLogin): stamps
        // last_login_at; super admins never reach this point.
        event(new Login('web', $user, false));

        return response()->json([
            'token' => $token,
            'user' => $this->conciseUser($user),
        ]);
    }

    /**
     * Signs out only this installation (other devices stay signed in): its
     * token is revoked and its push token cleared, so the signed-out phone
     * stops receiving notifications and its slot can be reused (RegisterDevice).
     */
    public function destroy(#[CurrentUser] User $user): JsonResponse
    {
        $device = Device::forAccessToken($user);

        DB::transaction(function () use ($user, $device): void {
            $device?->forceFill(['push_token' => null])->save();
            $user->currentAccessToken()->delete();
        });

        return response()->json(['message' => 'Berhasil keluar.']);
    }

    /** The caller's concise profile. */
    public function show(#[CurrentUser] User $user): JsonResponse
    {
        return response()->json(['user' => $this->conciseUser($user)]);
    }

    /**
     * 403 with a `code` the app can switch on, plus a ready-to-show message.
     */
    private function blocked(string $code, string $message): JsonResponse
    {
        return response()->json([
            'code' => $code,
            'message' => $message,
        ], 403);
    }

    /**
     * @return array<string, mixed>
     */
    private function conciseUser(User $user): array
    {
        $user->loadMissing(['division', 'position']);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'jabatan' => $user->position?->name,
            'divisi' => $user->division?->name,
            'work_mode' => [
                'value' => $user->work_mode->value,
                'label' => $user->work_mode->label(),
            ],
        ];
    }
}
