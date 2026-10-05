<?php

namespace App\Http\Controllers\Google;

use App\Domain\Google\Actions\DisconnectGoogleAccount;
use App\Domain\Google\Actions\StoreGoogleAccount;
use App\Domain\Google\Exceptions\GoogleAccountNotAllowed;
use App\Domain\Google\GoogleFeatures;
use App\Http\Controllers\Controller;
use App\Models\GoogleAccount;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as GoogleUser;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Per-user Google OAuth (incremental auth, scope drive.file) for Google
 * Picker: connect → Google consent → callback stores tokens; disconnect
 * removes them and revokes the grant.
 */
class GoogleConnectionController extends Controller
{
    private const string RETURN_KEY = 'google.connect.return';

    public function redirect(Request $request): Response
    {
        Gate::authorize('connect', GoogleAccount::class);

        if (GoogleFeatures::fake() || ! GoogleFeatures::oauthEnabled()) {
            return $this->finish(route('settings.google'), 'error', 'Sambungan akun Google belum diaktifkan. Hubungi admin RuangKerja.');
        }

        $request->session()->put(self::RETURN_KEY, $this->safeReturnPath($request->query('return')));

        $domain = (string) config('google.oauth.allowed_domain', '');

        /** @var list<string> $scopes */
        $scopes = config('google.oauth.scopes', []);

        /** @var AbstractProvider $provider */
        $provider = Socialite::driver('google-drive');

        $redirect = $provider
            ->scopes($scopes)
            ->with(array_filter([
                'access_type' => 'offline',
                'include_granted_scopes' => 'true',
                'prompt' => 'consent',
                'login_hint' => $request->user()?->email,
                'hd' => $domain !== '' ? $domain : null,
            ]))
            ->redirect();

        // Inertia visits need a full-page redirect to Google.
        return $request->header('X-Inertia') ? Inertia::location($redirect->getTargetUrl()) : $redirect;
    }

    public function callback(Request $request, #[CurrentUser] User $user, StoreGoogleAccount $store): RedirectResponse
    {
        Gate::authorize('connect', GoogleAccount::class);

        $return = $request->session()->pull(self::RETURN_KEY, route('settings.google', absolute: false));
        $return = is_string($return) ? $return : route('settings.google', absolute: false);

        if ($request->has('error') || ! GoogleFeatures::oauthEnabled()) {
            return $this->finish($return, 'warning', 'Sambungan akun Google dibatalkan.');
        }

        try {
            $googleUser = Socialite::driver('google-drive')->user();
        } catch (InvalidStateException) {
            return $this->finish($return, 'error', 'Sesi sambungan Google kedaluwarsa. Silakan coba lagi.');
        } catch (Throwable $exception) {
            Log::warning('google.oauth.callback_failed', ['exception' => $exception::class]);

            return $this->finish($return, 'error', 'Google menolak permintaan sambungan. Silakan coba lagi.');
        }

        if (! $googleUser instanceof GoogleUser) {
            return $this->finish($return, 'error', 'Google menolak permintaan sambungan. Silakan coba lagi.');
        }

        try {
            $account = $store->handle($user, $googleUser);
        } catch (GoogleAccountNotAllowed $exception) {
            return $this->finish($return, 'error', $exception->userMessage());
        }

        if (! $account->hasDriveAccess()) {
            return $this->finish($return, 'warning', 'Akun Google terhubung, tetapi izin Google Drive tidak diberikan. Hubungkan ulang dan centang akses Drive.');
        }

        return $this->finish($return, 'success', "Akun Google {$account->email} terhubung.");
    }

    public function destroy(#[CurrentUser] User $user, DisconnectGoogleAccount $disconnect): RedirectResponse
    {
        $account = GoogleAccount::query()->where('user_id', $user->id)->first();

        if ($account === null) {
            Inertia::flash('toast', ['type' => 'info', 'message' => 'Akun Google belum terhubung.']);

            return back();
        }

        Gate::authorize('delete', $account);

        $disconnect->handle($account);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Akun Google diputuskan.']);

        return back();
    }

    /**
     * Only same-site relative paths ("/workspace/x"), never "//evil" or URLs.
     */
    private function safeReturnPath(mixed $value): string
    {
        if (is_string($value) && preg_match('#^/(?![/\\\\])[^\s]*$#', $value) === 1) {
            return $value;
        }

        return route('settings.google', absolute: false);
    }

    private function finish(string $to, string $type, string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => $type, 'message' => $message]);

        return redirect($to);
    }
}
