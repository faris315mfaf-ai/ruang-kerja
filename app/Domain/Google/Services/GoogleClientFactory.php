<?php

namespace App\Domain\Google\Services;

use App\Domain\Google\Auth\ServiceAccountCredentials;
use App\Domain\Google\Auth\ServiceAccountTokenProvider;
use App\Domain\Google\Auth\UserAccessTokenProvider;
use App\Domain\Google\Contracts\DriveClient;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\Exceptions\GoogleNotConnected;
use App\Domain\Google\Exceptions\GoogleReconnectRequired;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Http\HttpDriveClient;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Settings\CompanySettings;
use App\Models\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Container\Container;

/**
 * Builds Drive clients:
 * - serviceAccount(): service account with domain-wide delegation,
 *   impersonating GOOGLE_IMPERSONATE_USER (folders, permissions, docs, uploads);
 * - forUser($user): the user's own OAuth token from google_accounts
 *   (files picked with Google Picker, scope drive.file).
 * In fake mode both return views of the bound FakeDriveClient.
 */
final class GoogleClientFactory
{
    public function __construct(
        private readonly Container $container,
        private readonly Cache $cache,
        private readonly GoogleUserTokens $userTokens,
    ) {}

    /**
     * @param  int|null  $timeout  seconds; defaults to google.http.timeout (jobs).
     *                             Pass syncTimeout() for calls the user waits on.
     * @param  string|null  $companyId  company whose Drive is used; null = current CompanyContext
     *
     * @throws GoogleNotConfigured
     */
    public function serviceAccount(?int $timeout = null, ?string $companyId = null): DriveClient
    {
        GoogleFeatures::ensureEnabled($companyId);

        if (GoogleFeatures::fake()) {
            return $this->fake()->withActor('service-account');
        }

        /** @var list<string> $scopes */
        $scopes = config('google.service_account.scopes', []);

        $tokens = new ServiceAccountTokenProvider(
            ServiceAccountCredentials::fromConfig(),
            (string) config('google.service_account.impersonate'),
            $scopes,
            $this->cache,
            $this->syncTimeout(),
        );

        return $this->http($tokens, $timeout);
    }

    /**
     * @throws GoogleNotConfigured|GoogleNotConnected|GoogleReconnectRequired
     */
    public function forUser(User $user, ?int $timeout = null): DriveClient
    {
        if (GoogleFeatures::fake()) {
            return $this->fake()->withActor($user->email);
        }

        GoogleFeatures::ensureOAuthEnabled();

        $account = $this->userTokens->accountFor($user);

        return $this->http(new UserAccessTokenProvider($account, $this->userTokens), $timeout);
    }

    /**
     * Shared Drive that holds the workspace folders of a company
     * (`companies.settings.google.shared_drive_id`; the global
     * GOOGLE_SHARED_DRIVE_ID only while it is the only company, or without
     * any company). Never another company's Drive.
     *
     * @param  string|null  $companyId  owner's company; null = current CompanyContext
     *
     * @throws GoogleNotConfigured
     */
    public function sharedDriveId(?string $companyId = null): string
    {
        $companyId ??= app(CompanyContext::class)->id();

        if ($companyId !== null) {
            $settings = CompanySettings::resolve();
            $own = $settings->own($companyId, CompanySettings::SHARED_DRIVE_ID);

            if ($own !== null) {
                return $own;
            }

            if (! $settings->usesGlobalFallback($companyId)) {
                throw new GoogleNotConfigured([GoogleFeatures::COMPANY_SHARED_DRIVE_SETTING]);
            }
        }

        $id = config('google.shared_drive_id');

        if (is_string($id) && $id !== '') {
            return $id;
        }

        if (GoogleFeatures::fake()) {
            return $this->fake()->sharedDriveId();
        }

        throw new GoogleNotConfigured(['GOOGLE_SHARED_DRIVE_ID']);
    }

    public function syncTimeout(): int
    {
        return (int) config('google.http.sync_timeout', 10);
    }

    private function http(ServiceAccountTokenProvider|UserAccessTokenProvider $tokens, ?int $timeout): HttpDriveClient
    {
        return new HttpDriveClient(
            $tokens,
            $timeout ?? (int) config('google.http.timeout', 30),
            (int) config('google.http.connect_timeout', 5),
            (int) config('google.http.upload_timeout', 120),
        );
    }

    private function fake(): FakeDriveClient
    {
        return $this->container->make(FakeDriveClient::class);
    }
}
