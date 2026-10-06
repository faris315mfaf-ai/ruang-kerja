<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Auth\Actions\ChangeOwnPassword;
use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureTwoFactorForSuperAdmin;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

/**
 * Pengaturan › Keamanan: every employee changes their own password (owner
 * decision 6 Oct 2026); Super Admins also manage TOTP here.
 */
class SecurityController extends Controller
{
    public function edit(TwoFactorAuthenticationRequest $request, #[CurrentUser] User $user): Response
    {
        Gate::authorize('manageCredentials', $user);

        $canManageTwoFactor = Features::canManageTwoFactorAuthentication() && Gate::allows('manageTwoFactor', $user);

        $props = [
            'canManageTwoFactor' => $canManageTwoFactor,
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'twoFactorRequired' => EnsureTwoFactorForSuperAdmin::mustSetUp($request, $user),
            'passwordChangeRequired' => $user->password_change_required,
            'hasPassword' => $user->password !== null,
        ];

        if ($canManageTwoFactor) {
            $request->ensureStateIsValid();

            $props['twoFactorEnabled'] = $user->hasEnabledTwoFactorAuthentication();
            $props['requiresConfirmation'] = Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm');
        }

        return Inertia::render('settings/security', $props);
    }

    public function update(PasswordUpdateRequest $request, #[CurrentUser] User $user, ChangeOwnPassword $changePassword): RedirectResponse
    {
        Gate::authorize('manageCredentials', $user);

        $wasRequired = $user->password_change_required;

        $changePassword->handle($user, $request->string('password')->toString());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Kata sandi diperbarui. Perangkat lain sudah dikeluarkan.']);

        return $wasRequired ? to_route('dashboard') : back();
    }
}
