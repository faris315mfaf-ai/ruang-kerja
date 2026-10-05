<?php

namespace App\Providers;

use App\Domain\Google\Access\DenyWorkspaceDriveAccess;
use App\Domain\Google\Contracts\DriveClient;
use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Domain\Google\Services\GoogleClientFactory;
use App\Domain\Google\Testing\FakeDriveClient;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\ServiceProvider;
use Laravel\Socialite\Contracts\Factory as SocialiteFactory;
use Laravel\Socialite\SocialiteManager;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\GoogleProvider;

/**
 * Wires the Google domain layer (docs/sprints/sprint-7/GOOGLE-API.md).
 */
class GoogleServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(GoogleClientFactory::class);

        // Service-account client; prefer the factory when a timeout matters.
        $this->app->bind(DriveClient::class, fn (Application $app): DriveClient => $app->make(GoogleClientFactory::class)->serviceAccount());

        $this->app->singleton(FakeDriveClient::class, function (Application $app): FakeDriveClient {
            $sharedDriveId = config('google.shared_drive_id');

            return new FakeDriveClient(
                is_string($sharedDriveId) && $sharedDriveId !== '' ? $sharedDriveId : FakeDriveClient::SHARED_DRIVE_ID,
                // Local fake mode keeps its Drive between requests; tests stay in memory.
                $app->runningUnitTests() ? null : Cache::store(),
            );
        });

        // Fail-closed until the Workspaces module binds its implementation.
        $this->app->singletonIf(WorkspaceDriveAccess::class, DenyWorkspaceDriveAccess::class);
    }

    public function boot(): void
    {
        // Separate driver from the login provider: own redirect URI + drive.file scope.
        $this->callAfterResolving(SocialiteFactory::class, function (SocialiteFactory $socialite): void {
            if (! $socialite instanceof SocialiteManager) {
                return;
            }

            $socialite->extend('google-drive', fn (): AbstractProvider => $socialite->buildProvider(GoogleProvider::class, [
                'client_id' => config('google.oauth.client_id'),
                'client_secret' => config('google.oauth.client_secret'),
                'redirect' => config('google.oauth.redirect'),
            ]));
        });
    }
}
