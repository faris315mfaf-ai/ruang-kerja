<?php

namespace App\Domain\Google\Jobs;

use App\Domain\Google\GoogleFeatures;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Revokes a user's OAuth grant at Google after "Putuskan akun Google".
 * The payload is encrypted on the queue; the token is never logged.
 */
final class RevokeGoogleToken implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /**
     * @var list<int>
     */
    public array $backoff = [30, 120];

    public function __construct(#[\SensitiveParameter] public string $token) {}

    public function handle(): void
    {
        if (GoogleFeatures::fake()) {
            return;
        }

        try {
            $response = Http::asForm()
                ->timeout((int) config('google.http.timeout', 30))
                ->post((string) config('google.oauth.revoke_uri'), ['token' => $this->token]);
        } catch (ConnectionException) {
            throw new RuntimeException('Google token revocation could not connect.');
        }

        // 400 invalid_token: already revoked or expired — nothing left to do.
        if ($response->serverError()) {
            throw new RuntimeException('Google token revocation failed with status '.$response->status().'.');
        }

        Log::info('google.oauth.revoked', ['status' => $response->status()]);
    }
}
