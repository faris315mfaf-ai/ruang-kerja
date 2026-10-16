<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Auth\Actions\ApiSignIn;
use App\Domain\Auth\Actions\VerifyApiTwoFactor;
use App\Domain\Auth\Services\ApiTwoFactorChallenge;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TwoFactorChallengeRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

/**
 * POST /api/v1/auth/dua-faktor — second step of a TOTP sign-in (guest; the
 * challenge token from login / "Lupa kata sandi" is the credential).
 *
 * - 200 same body as a normal login (`token`, `user`, `password_change_required`);
 * - 422 `{code: challenge_expired}` — unknown, expired, used or exhausted
 *   challenge: sign in again;
 * - 422 `{errors.code}` — wrong code (5 wrong codes destroy the challenge);
 * - 429 — `api-two-factor` limiter (5/min per challenge + IP).
 */
class TwoFactorController extends Controller
{
    public function __construct(
        private readonly ApiTwoFactorChallenge $challenges,
        private readonly VerifyApiTwoFactor $verify,
        private readonly ApiSignIn $signIn,
    ) {}

    public function __invoke(TwoFactorChallengeRequest $request): JsonResponse
    {
        $token = $request->challengeToken();
        $payload = $this->challenges->peek($token);
        $user = $payload === null ? null : User::query()->find($payload['user_id']);

        if ($payload === null || $user === null || ! $user->isActive() || ! $user->hasEnabledTwoFactorAuthentication()) {
            return $this->expired();
        }

        if (! $this->verify->handle($user, $request->code(), $request->recoveryCode())) {
            if (! $this->challenges->recordFailure($token)) {
                return $this->expired();
            }

            throw ValidationException::withMessages([
                'code' => 'Kode autentikator atau kode pemulihan salah.',
            ]);
        }

        // Single use: claim it before issuing (a parallel request loses here).
        $claimed = $this->challenges->consume($token);

        if ($claimed === null) {
            return $this->expired();
        }

        try {
            $outcome = $this->signIn->issueToken($user, $claimed['device']);
        } catch (ValidationException $e) {
            // e.g. the 5-device limit: the code was fine, let the app retry after fixing it.
            $this->challenges->restore($token, $claimed);

            throw $e;
        }

        return response()->json($outcome['body'], $outcome['status']);
    }

    private function expired(): JsonResponse
    {
        return response()->json([
            'code' => 'challenge_expired',
            'message' => 'Sesi verifikasi sudah berakhir. Masuk ulang untuk mendapatkan sesi baru.',
        ], 422);
    }
}
