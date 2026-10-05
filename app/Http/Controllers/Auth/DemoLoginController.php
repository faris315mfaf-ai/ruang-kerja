<?php

namespace App\Http\Controllers\Auth;

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * One-click login for local demo accounts (APP_ENV=local + DEMO_LOGIN_ENABLED only).
 * Bypasses the Google / Super-Admin-TOTP rules by design; `last_login_at` is stamped
 * by the RecordLogin listener.
 */
class DemoLoginController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        // Checked per request (not at boot) so the route is inert outside APP_ENV=local.
        abort_unless(DemoAccounts::enabled(), 404);

        $validated = $request->validate([
            'email' => ['required', 'string', Rule::in(DemoAccounts::emails())],
        ], [
            'email.required' => 'Pilih akun demo.',
            'email.in' => 'Akun demo tidak dikenal.',
        ]);

        $user = User::query()->where('email', $validated['email'])->first();

        if ($user === null) {
            throw ValidationException::withMessages([
                'email' => 'Akun demo belum dibuat. Jalankan `php artisan db:seed`.',
            ]);
        }

        LoginMethod::Demo->declareFor($request);
        Auth::guard('web')->login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
