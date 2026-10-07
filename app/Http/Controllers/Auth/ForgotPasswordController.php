<?php

namespace App\Http\Controllers\Auth;

use App\Domain\Auth\Actions\CheckPasswordResetStatus;
use App\Domain\Auth\Actions\CompletePasswordReset;
use App\Domain\Auth\Actions\RequestPasswordReset;
use App\Domain\Auth\Data\PasswordResetSession;
use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Services\PasswordPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\CompletePasswordResetRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Models\PasswordResetRequest;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

/**
 * "Lupa kata sandi" with HR approval (guests; owner decision 6 Oct 2026):
 * form → waiting page that polls the status → HR approves → new password →
 * signed in. Every step answers the same for unknown addresses (the session
 * alone backs their waiting page). See docs/ARCHITECTURE.md §5.
 */
class ForgotPasswordController extends Controller
{
    public function create(Request $request): Response
    {
        return Inertia::render('auth/forgot-password', [
            'email' => PasswordResetSession::from($request->session())?->email,
        ]);
    }

    public function store(ForgotPasswordRequest $request, RequestPasswordReset $requestReset): RedirectResponse
    {
        $email = $request->email();

        $token = $requestReset->handle($email, $request->ip(), $request->userAgent());

        (new PasswordResetSession($token, $email, CarbonImmutable::now()))->store($request->session());

        return to_route('password-reset.waiting');
    }

    public function waiting(Request $request, CheckPasswordResetStatus $check): Response|RedirectResponse
    {
        $session = PasswordResetSession::from($request->session());

        if ($session === null) {
            return to_route('password-reset.create');
        }

        $result = $check->handle($session);
        $result['session']->store($request->session());

        if ($result['status'] === 'approved') {
            return to_route('password-reset.edit');
        }

        return Inertia::render('auth/password-reset-waiting', [
            'email' => $session->email,
            'status' => $result['status'],
            'reason' => $result['reason'],
            'requestedAt' => $session->requestedAt->toIso8601String(),
            'expiresAt' => $session->requestedAt->addHours(PasswordResetRequest::PENDING_HOURS)->toIso8601String(),
        ]);
    }

    /**
     * Polled by the waiting page every 5 seconds: `{status}` only.
     */
    public function status(Request $request, CheckPasswordResetStatus $check): JsonResponse
    {
        $session = PasswordResetSession::from($request->session());

        if ($session === null) {
            return response()->json(['status' => 'expired']);
        }

        $result = $check->handle($session);
        $result['session']->store($request->session());

        return response()->json(['status' => $result['status']]);
    }

    public function edit(Request $request, PasswordPolicy $passwords): Response|RedirectResponse
    {
        $resetRequest = $this->approvedRequest($request);

        if ($resetRequest === null) {
            return to_route(PasswordResetSession::from($request->session()) === null ? 'password-reset.create' : 'password-reset.waiting');
        }

        return Inertia::render('auth/password-reset-new', [
            'email' => $resetRequest->user->email ?? $resetRequest->email,
            'name' => $resetRequest->user?->name,
            'expiresAt' => $resetRequest->setupExpiresAt()?->toIso8601String(),
            'passwordRules' => $passwords->browserRules($resetRequest->user),
            'passwordHint' => $passwords->hint($resetRequest->user),
        ]);
    }

    public function update(CompletePasswordResetRequest $request, CompletePasswordReset $complete): RedirectResponse
    {
        $resetRequest = $this->approvedRequest($request);

        if ($resetRequest === null) {
            return to_route('password-reset.waiting');
        }

        $user = $complete->handle($resetRequest, $request->string('password')->toString());

        PasswordResetSession::forget($request->session());

        // A Super Admin with TOTP signs in again so the second factor is still checked.
        if ($user->hasEnabledTwoFactorAuthentication()) {
            $request->session()->regenerate();

            return to_route('login')->with('status', 'Kata sandi diperbarui. Masuk dengan kata sandi baru dan kode autentikator Anda.');
        }

        LoginMethod::Password->declareFor($request);
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Kata sandi baru tersimpan. Selamat datang kembali.']);

        return to_route('dashboard');
    }

    /**
     * The approved request this browser holds the setup token for, while the
     * 30-minute window is open.
     */
    private function approvedRequest(Request $request): ?PasswordResetRequest
    {
        $setupToken = PasswordResetSession::from($request->session())?->setupToken;

        if ($setupToken === null) {
            return null;
        }

        $resetRequest = PasswordResetRequest::query()
            ->with('user')
            ->where('setup_token_hash', PasswordResetRequest::hashToken($setupToken))
            ->where('status', PasswordResetStatus::Approved->value)
            ->first();

        return $resetRequest?->canBeCompleted() === true ? $resetRequest : null;
    }
}
