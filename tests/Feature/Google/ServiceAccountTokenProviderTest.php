<?php

use App\Domain\Google\Auth\ServiceAccountCredentials;
use App\Domain\Google\Auth\ServiceAccountTokenProvider;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    Http::preventStrayRequests();
    GoogleTesting::useRealServiceAccount();
});

function tokenProvider(): ServiceAccountTokenProvider
{
    return new ServiceAccountTokenProvider(
        ServiceAccountCredentials::fromConfig(),
        GoogleTesting::IMPERSONATE,
        ['https://www.googleapis.com/auth/drive'],
        Cache::store(),
    );
}

function decodeJwtPart(string $part): array
{
    return json_decode(base64_decode(strtr($part, '-_', '+/')), true);
}

it('signs an RS256 assertion that impersonates the Workspace admin', function () {
    $this->travelTo('2026-10-05 08:00:00');

    [$header, $claims, $signature] = explode('.', tokenProvider()->assertion());

    expect(decodeJwtPart($header))->toBe(['alg' => 'RS256', 'typ' => 'JWT'])
        ->and(decodeJwtPart($claims))->toMatchArray([
            'iss' => 'ruangkerja@project.iam.gserviceaccount.com',
            'sub' => GoogleTesting::IMPERSONATE,
            'scope' => 'https://www.googleapis.com/auth/drive',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => now()->getTimestamp(),
            'exp' => now()->getTimestamp() + 3600,
        ])
        ->and(openssl_verify(
            $header.'.'.$claims,
            base64_decode(strtr($signature, '-_', '+/')),
            GoogleTesting::publicKey(),
            OPENSSL_ALGO_SHA256,
        ))->toBe(1);
});

it('exchanges the assertion for an access token and caches it encrypted', function () {
    Http::fake(GoogleTesting::tokenResponse());

    $provider = tokenProvider();

    expect($provider->token())->toBe(GoogleTesting::SA_TOKEN)
        ->and($provider->token())->toBe(GoogleTesting::SA_TOKEN);

    Http::assertSentCount(1);
    Http::assertSent(fn (Request $request) => $request->url() === 'https://oauth2.googleapis.com/token'
        && $request['grant_type'] === 'urn:ietf:params:oauth:grant-type:jwt-bearer'
        && substr_count((string) $request['assertion'], '.') === 2);

    $cacheKey = 'google:sa-token:'.sha1('ruangkerja@project.iam.gserviceaccount.com|'.GoogleTesting::IMPERSONATE.'|https://www.googleapis.com/auth/drive');
    expect(Cache::get($cacheKey))->toBeString()->not->toContain(GoogleTesting::SA_TOKEN);
});

it('fetches a new token after forget()', function () {
    Http::fake(GoogleTesting::tokenResponse());

    $provider = tokenProvider();
    $provider->token();
    $provider->forget();
    $provider->token();

    Http::assertSentCount(2);
});

it('reports token endpoint errors without leaking the assertion or key', function () {
    Http::fake(['oauth2.googleapis.com/token' => Http::response([
        'error' => 'unauthorized_client',
        'error_description' => 'Client is unauthorized to retrieve access tokens using this method.',
    ], 401)]);

    try {
        tokenProvider()->token();
        $this->fail('Expected DriveRequestFailed.');
    } catch (DriveRequestFailed $exception) {
        expect($exception->status)->toBe(401)
            ->and($exception->reason)->toBe('unauthorized_client')
            ->and($exception->isRetryable())->toBeFalse()
            ->and($exception->getMessage())->not->toContain('PRIVATE KEY')
            ->and($exception->getMessage())->not->toContain('eyJ');
    }
});

it('rejects an invalid service account key', function (string $value) {
    ServiceAccountCredentials::fromString($value);
})->with([
    'not json' => ['{oops'],
    'missing private key' => ['{"client_email":"x@y.z"}'],
    'unreadable path' => ['/nope/key.json'],
])->throws(GoogleNotConfigured::class);

it('does not expose the private key when dumped', function () {
    expect(print_r(ServiceAccountCredentials::fromConfig(), true))->not->toContain('PRIVATE KEY');
});
