<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Auth\Actions\ApiSignIn;
use App\Domain\Auth\Actions\CheckPasswordResetStatus;
use App\Domain\Auth\Actions\CompletePasswordReset;
use App\Domain\Auth\Actions\RequestPasswordReset;
use App\Domain\Auth\Data\PasswordResetSession;
use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Services\ApiPasswordResetToken;
use App\Domain\Auth\Services\PasswordPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CompletePasswordResetRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Models\PasswordResetRequest;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * "Lupa kata sandi" with HR approval for the mobile app (guest endpoints; the
 * web counterpart is ForgotPasswordController — same Actions, same rules).
 * The web keeps the request token in the session, the app keeps it itself:
 *
 * 1. POST /auth/lupa-sandi {email} → `{request_token, expires_at}` — identical
 *    for unknown addresses (same timebox, no row);
 * 2. GET /auth/lupa-sandi/status (header `X-Reset-Token`) every ~5 s until a
 *    final status;
 * 3. `approved` carries a one-time `setup_token` (30 minutes after approval);
 *    POST /auth/lupa-sandi/selesai {setup_token, password, password_confirmation,
 *    device} saves the new password, signs every old session out and answers
 *    like a login (device token, or a TOTP challenge).
 */
class PasswordResetController extends Controller
{
    public function __construct(private readonly PasswordPolicy $passwords) {}

    public function store(ForgotPasswordRequest $request, RequestPasswordReset $requestReset): JsonResponse
    {
        $now = CarbonImmutable::now();
        $token = $requestReset->handle($request->email(), $request->ip(), $request->userAgent());

        return response()->json([
            'request_token' => ApiPasswordResetToken::wrap($token, $now),
            'expires_at' => $now->addHours(PasswordResetRequest::PENDING_HOURS)->toIso8601String(),
            'message' => 'Permintaan terkirim. Bila alamat ini terdaftar, HR akan menerima permintaan Anda.',
        ]);
    }

    /**
     * `{status}` is pending | approved | rejected | expired. A malformed or
     * forged token reads `expired`; unknown addresses read `pending` for 24
     * hours and then `expired`, exactly like real ones.
     */
    public function status(Request $request, CheckPasswordResetStatus $check): JsonResponse
    {
        $wrapped = self::requestToken($request);

        if ($wrapped === null) {
            throw ValidationException::withMessages(['request_token' => 'Token permintaan wajib dikirim (header X-Reset-Token).']);
        }

        $parts = ApiPasswordResetToken::unwrap($wrapped);

        if ($parts === null) {
            return response()->json(['status' => 'expired']);
        }

        $result = $check->handle(new PasswordResetSession($parts['token'], '', $parts['requestedAt']));
        $body = ['status' => $result['status']];

        if ($result['status'] === 'pending') {
            $body['expires_at'] = $parts['requestedAt']->addHours(PasswordResetRequest::PENDING_HOURS)->toIso8601String();
        }

        if ($result['status'] === 'rejected') {
            $body['reject_reason'] = $result['reason'];
        }

        $setupToken = $result['session']->setupToken;

        if ($result['status'] === 'approved' && $setupToken !== null) {
            $resetRequest = $this->approvedRequest($setupToken);

            $body['setup_token'] = $setupToken;
            $body['setup_expires_at'] = $resetRequest?->setupExpiresAt()?->toIso8601String();
            $body['password_hint'] = $this->passwords->hint($resetRequest?->user);
        }

        return response()->json($body);
    }

    public function complete(CompletePasswordResetRequest $request, CompletePasswordReset $complete, ApiSignIn $signIn): JsonResponse
    {
        $resetRequest = $this->approvedRequest($request->setupToken());

        if ($resetRequest === null) {
            return response()->json([
                'code' => 'setup_token_invalid',
                'message' => CompletePasswordReset::INVALID,
                'errors' => ['setup_token' => [CompletePasswordReset::INVALID]],
            ], 422);
        }

        $user = $complete->handle($resetRequest, $request->string('password')->toString());

        $outcome = $signIn->begin($user, $request->devicePayload(), false);

        return response()->json($outcome['body'], $outcome['status']);
    }

    /**
     * The approved request behind a setup token, while its 30-minute window is open.
     */
    private function approvedRequest(string $setupToken): ?PasswordResetRequest
    {
        $resetRequest = PasswordResetRequest::query()
            ->with('user')
            ->where('setup_token_hash', PasswordResetRequest::hashToken($setupToken))
            ->where('status', PasswordResetStatus::Approved->value)
            ->first();

        return $resetRequest?->canBeCompleted() === true ? $resetRequest : null;
    }

    public static function requestToken(Request $request): ?string
    {
        $token = $request->header('X-Reset-Token') ?? $request->query('request_token');

        return is_string($token) && $token !== '' ? $token : null;
    }
}
