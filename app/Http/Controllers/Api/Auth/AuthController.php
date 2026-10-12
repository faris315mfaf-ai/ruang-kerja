<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Auth\Actions\ApiSignIn;
use App\Domain\Auth\Actions\AuthenticateEmployee;
use App\Domain\Devices\Models\Device;
use App\Http\Controllers\Controller;
use App\Http\Presenters\ApiUserPresenter;
use App\Http\Requests\Api\LoginRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Laravel\Fortify\LoginRateLimiter;

/**
 * Authentication for the mobile app (POST /api/v1/auth/*). Credentials are
 * verified by the web mechanism (AuthenticateEmployee: constant-time check,
 * generic error, audited failures); ApiSignIn then decides between a device
 * token (one active token per installation, Device::sanctumTokenName:
 * re-login replaces the previous token), a TOTP challenge and a refusal.
 * Rest of the flows: TwoFactorController, PasswordController,
 * PasswordResetController.
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly AuthenticateEmployee $authenticate,
        private readonly ApiSignIn $signIn,
        private readonly LoginRateLimiter $limiter,
        private readonly ApiUserPresenter $presenter,
    ) {}

    /**
     * Sign in. Answers one of:
     *
     * - 200 `{token, user, password_change_required}` — device token;
     * - 200 `{two_factor_required: true, challenge_token, expires_in}` — the
     *   account has confirmed TOTP, finish with POST /auth/dua-faktor;
     * - 403 `{code, message}` — `password_change_required` (temporary HR
     *   password; only when the app did not send `supports_password_change`)
     *   or `two_factor_setup_required` (Super Admin without confirmed TOTP:
     *   enable it on the web first).
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

        $outcome = $this->signIn->begin($user, $request->devicePayload(), $request->supportsPasswordChange());

        if ($outcome['status'] === 200) {
            $this->limiter->clear($request);
        }

        return response()->json($outcome['body'], $outcome['status']);
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

    /** The caller's profile (ApiUserPresenter::profile). */
    public function show(#[CurrentUser] User $user): JsonResponse
    {
        return response()->json(['user' => $this->presenter->profile($user)]);
    }
}
