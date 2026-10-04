<?php

namespace App\Http\Controllers\Settings;

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
 * Password + TOTP for the emergency Super Admin sign-in. Everyone else signs
 * in with Google and gets 403 (UserPolicy::manageCredentials).
 */
class SecurityController extends Controller
{
    public function edit(TwoFactorAuthenticationRequest $request, #[CurrentUser] User $user): Response
    {
        Gate::authorize('manageCredentials', $user);

        $props = [
            'canManageTwoFactor' => Features::canManageTwoFactorAuthentication(),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'twoFactorRequired' => EnsureTwoFactorForSuperAdmin::mustSetUp($request, $user),
        ];

        if (Features::canManageTwoFactorAuthentication()) {
            $request->ensureStateIsValid();

            $props['twoFactorEnabled'] = $user->hasEnabledTwoFactorAuthentication();
            $props['requiresConfirmation'] = Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm');
        }

        return Inertia::render('settings/security', $props);
    }

    public function update(PasswordUpdateRequest $request, #[CurrentUser] User $user): RedirectResponse
    {
        Gate::authorize('manageCredentials', $user);

        $user->update([
            'password' => $request->password,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Kata sandi diperbarui.']);

        return back();
    }
}
