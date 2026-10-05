<?php

namespace App\Http\Controllers\Auth;

use App\Domain\Auth\Actions\AuthenticateGoogleUser;
use App\Domain\Auth\Data\GoogleProfile;
use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Auth\Exceptions\LoginRejected;
use App\Domain\Auth\Support\GoogleOAuth;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\AbstractUser;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;
use Throwable;

/**
 * "Masuk dengan Google Workspace" (guest only; the callback is rate limited
 * 60/min per IP + 10/min per session, see FortifyServiceProvider).
 * Errors go back to the login page under the `google` key; the rejected
 * address is flashed as `google_email` for the error card.
 */
class GoogleLoginController extends Controller
{
    public const string NOT_CONFIGURED = 'Login Google belum dikonfigurasi. Hubungi Super Admin.';

    public const string FAILED = 'Login Google gagal atau dibatalkan. Silakan coba lagi.';

    public function redirect(): SymfonyRedirectResponse
    {
        if (! GoogleOAuth::configured()) {
            return $this->fail(self::NOT_CONFIGURED);
        }

        $parameters = ['prompt' => 'select_account'];

        $domain = GoogleOAuth::hintDomain();

        if ($domain !== null) {
            $parameters['hd'] = $domain;
        }

        /** @var AbstractProvider $driver */
        $driver = Socialite::driver('google');

        return $driver->scopes(['openid', 'email', 'profile'])->with($parameters)->redirect();
    }

    public function callback(Request $request, AuthenticateGoogleUser $authenticate): RedirectResponse
    {
        if (! GoogleOAuth::configured()) {
            return $this->fail(self::NOT_CONFIGURED);
        }

        // User pressed "Cancel" on Google's consent screen.
        if ($request->filled('error')) {
            return $this->fail(self::FAILED);
        }

        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (Throwable $exception) {
            // Invalid state, expired code, network error. Never log tokens.
            Log::warning('Google login callback failed', ['exception' => $exception::class]);

            return $this->fail(self::FAILED);
        }

        if (! $googleUser instanceof AbstractUser) {
            return $this->fail(self::FAILED);
        }

        try {
            $user = $authenticate->handle(GoogleProfile::fromSocialite($googleUser));
        } catch (LoginRejected $rejected) {
            return $this->fail($rejected->getMessage(), $rejected->email);
        }

        LoginMethod::Google->declareFor($request);
        Auth::guard('web')->login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    private function fail(string $message, ?string $email = null): RedirectResponse
    {
        return redirect()->route('login')
            ->withErrors(['google' => $message])
            ->with('google_email', $email);
    }
}
