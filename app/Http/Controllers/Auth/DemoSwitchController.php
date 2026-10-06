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
 * Account switcher at the top of the shell (local demo only, same guard as
 * DemoLoginController): signs the current user out and the chosen persona in,
 * with a fresh session, then lands on the new user's dashboard (the page the
 * previous persona had open may not be allowed for the next one).
 */
class DemoSwitchController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
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

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        LoginMethod::Demo->declareFor($request);
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return redirect()->route('dashboard');
    }
}
