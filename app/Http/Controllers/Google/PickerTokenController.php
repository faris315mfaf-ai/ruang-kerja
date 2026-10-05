<?php

namespace App\Http\Controllers\Google;

use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConnected;
use App\Domain\Google\Exceptions\GoogleReconnectRequired;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Services\GoogleUserTokens;
use App\Http\Controllers\Controller;
use App\Models\GoogleAccount;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Short-lived access token + Picker settings for the signed-in user.
 * Expected states are 200 with a `status` the frontend switches on:
 * ready · not_configured · not_connected · reconnect_required.
 * The token is never logged and the response is not cached.
 */
class PickerTokenController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, GoogleUserTokens $tokens): JsonResponse
    {
        Gate::authorize('usePicker', GoogleAccount::class);

        if (! GoogleFeatures::pickerEnabled()) {
            return $this->respond([
                'status' => 'not_configured',
                'message' => 'Google Picker belum diaktifkan. Hubungi admin RuangKerja.',
            ]);
        }

        try {
            $account = $tokens->accountFor($user);
            $accessToken = $tokens->accessToken($account);
        } catch (GoogleNotConnected $exception) {
            return $this->respond([
                'status' => 'not_connected',
                'message' => $exception->userMessage(),
                'connect_url' => route('google.connect'),
            ]);
        } catch (GoogleReconnectRequired $exception) {
            return $this->respond([
                'status' => 'reconnect_required',
                'message' => $exception->userMessage(),
                'connect_url' => route('google.connect'),
            ]);
        } catch (DriveRequestFailed $exception) {
            return $this->respond([
                'status' => 'error',
                'message' => $exception->userMessage(),
            ], 502);
        }

        return $this->respond([
            'status' => 'ready',
            'access_token' => $accessToken,
            'expires_at' => $account->expires_at?->toIso8601String(),
            'developer_key' => (string) config('google.picker.api_key'),
            'app_id' => (string) GoogleFeatures::pickerAppId(),
            'locale' => 'id',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function respond(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'no-store, private');
    }
}
