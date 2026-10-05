<?php

namespace App\Http\Controllers\Google;

use App\Domain\Google\GoogleFeatures;
use App\Http\Controllers\Controller;
use App\Models\GoogleAccount;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Settings › Akun Google: connection status, connect / disconnect.
 */
class GoogleSettingsController extends Controller
{
    public function edit(#[CurrentUser] User $user): Response
    {
        Gate::authorize('connect', GoogleAccount::class);

        $account = GoogleAccount::query()->where('user_id', $user->id)->first();
        $isAdmin = $user->isSuperAdmin();

        return Inertia::render('settings/google', [
            'google' => [
                'drive_enabled' => GoogleFeatures::enabled(),
                'connect_enabled' => GoogleFeatures::oauthEnabled() && ! GoogleFeatures::fake(),
                'picker_enabled' => GoogleFeatures::pickerEnabled(),
                'fake' => GoogleFeatures::fake(),
                'account' => $account === null ? null : [
                    'email' => $account->email,
                    'connected_at' => $account->created_at?->toIso8601String(),
                    'has_drive_access' => $account->hasDriveAccess(),
                    'needs_reconnect' => $account->needsReconnect(),
                ],
                // Env key names only (never values), for the Super Admin.
                'missing_settings' => $isAdmin
                    ? [...GoogleFeatures::missingDriveSettings(), ...GoogleFeatures::missingOAuthSettings()]
                    : [],
            ],
        ]);
    }
}
