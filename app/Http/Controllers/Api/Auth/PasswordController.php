<?php

namespace App\Http\Controllers\Api\Auth;

use App\Domain\Auth\Actions\ChangeOwnPassword;
use App\Domain\Devices\Models\Device;
use App\Http\Controllers\Controller;
use App\Http\Presenters\ApiUserPresenter;
use App\Http\Requests\Api\ChangePasswordRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * POST /api/v1/auth/sandi — the employee changes their own password
 * (ChangeOwnPassword, UserPolicy::manageCredentials, PasswordPolicy — the same
 * as Pengaturan › Keamanan on the web). Works while "wajib ganti" blocks the
 * rest of the API (EnsureApiAccountUsable::ALLOWED_ROUTES) and clears that
 * flag. Every OTHER installation is signed out; this device's token stays valid.
 */
class PasswordController extends Controller
{
    public function __construct(private readonly ApiUserPresenter $presenter) {}

    public function update(ChangePasswordRequest $request, #[CurrentUser] User $user, ChangeOwnPassword $changePassword): JsonResponse
    {
        Gate::authorize('manageCredentials', $user);

        $changePassword->handle($user, $request->string('password')->toString(), Device::forAccessToken($user));

        return response()->json([
            'message' => 'Kata sandi diperbarui. Perangkat lain sudah dikeluarkan.',
            'password_change_required' => false,
            'user' => $this->presenter->profile($user->refresh()),
        ]);
    }
}
