<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Organization\Actions\UpdateUserTheme;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ThemeUpdateRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Gate;

class ThemeController extends Controller
{
    /**
     * Lifetime of the `appearance` cookie in minutes (one year).
     */
    private const int COOKIE_MINUTES = 60 * 24 * 365;

    /**
     * Persist the user's theme preference (users.theme + `appearance` cookie).
     *
     * JSON/XHR callers receive 204 No Content; regular form/Inertia visits are redirected back.
     */
    public function update(
        ThemeUpdateRequest $request,
        #[CurrentUser] User $user,
        UpdateUserTheme $updateUserTheme,
    ): Response|RedirectResponse {
        Gate::authorize('updateTheme', $user);

        $theme = $request->theme();

        $updateUserTheme->handle($user, $theme);

        // Not HttpOnly: the frontend (use-appearance) also writes this cookie via document.cookie.
        $cookie = Cookie::make('appearance', $theme->value, self::COOKIE_MINUTES, httpOnly: false, sameSite: 'lax');

        $response = $request->expectsJson() ? response()->noContent() : back();

        return $response->withCookie($cookie);
    }
}
