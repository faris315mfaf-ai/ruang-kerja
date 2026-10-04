<?php

use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\GoogleFeatures;
use Illuminate\Http\Request;
use Tests\Fixtures\Google\GoogleTesting;

it('is enabled in fake mode (the test suite default)', function () {
    expect(config('google.fake'))->toBeTrue()
        ->and(GoogleFeatures::fake())->toBeTrue()
        ->and(GoogleFeatures::enabled())->toBeTrue();
});

it('never honours fake mode in production', function () {
    app()->detectEnvironment(fn () => 'production');
    config(['google.service_account.credentials' => null]);

    expect(GoogleFeatures::fake())->toBeFalse()
        ->and(GoogleFeatures::enabled())->toBeFalse();
});

it('is disabled and lists the missing env keys when nothing is configured', function () {
    GoogleTesting::disable();

    expect(GoogleFeatures::enabled())->toBeFalse()
        ->and(GoogleFeatures::oauthEnabled())->toBeFalse()
        ->and(GoogleFeatures::pickerEnabled())->toBeFalse()
        ->and(GoogleFeatures::missingDriveSettings())->toBe(['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_IMPERSONATE_USER', 'GOOGLE_SHARED_DRIVE_ID'])
        ->and(GoogleFeatures::missingOAuthSettings())->toBe(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
});

it('throws a friendly Indonesian error when Drive is used while disabled', function () {
    GoogleTesting::disable();

    try {
        GoogleFeatures::ensureEnabled();
        $this->fail('Expected GoogleNotConfigured.');
    } catch (GoogleNotConfigured $exception) {
        expect($exception->userMessage())->toBe('Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja.')
            ->and($exception->errorCode())->toBe('google_not_configured')
            ->and($exception->missing)->toContain('GOOGLE_SHARED_DRIVE_ID');
    }
});

it('accepts the service account key as a readable file or as inline JSON', function () {
    GoogleTesting::useRealServiceAccount();
    expect(GoogleFeatures::enabled())->toBeTrue();

    $path = tempnam(sys_get_temp_dir(), 'sa');
    file_put_contents($path, GoogleTesting::serviceAccountJson());
    config(['google.service_account.credentials' => $path]);
    expect(GoogleFeatures::enabled())->toBeTrue();

    config(['google.service_account.credentials' => '/does/not/exist.json']);
    expect(GoogleFeatures::enabled())->toBeFalse()
        ->and(GoogleFeatures::missingDriveSettings())->toBe(['GOOGLE_SERVICE_ACCOUNT_JSON']);

    unlink($path);
});

it('derives the Picker app id from the OAuth client id unless set explicitly', function () {
    GoogleTesting::disable();
    GoogleTesting::configureOAuth();

    expect(GoogleFeatures::pickerAppId())->toBe('123456789012')
        ->and(GoogleFeatures::pickerEnabled())->toBeTrue();

    config(['google.picker.app_id' => '999']);
    expect(GoogleFeatures::pickerAppId())->toBe('999');

    config(['google.picker.app_id' => null, 'google.oauth.client_id' => 'not-numeric.apps.googleusercontent.com']);
    expect(GoogleFeatures::pickerAppId())->toBeNull()
        ->and(GoogleFeatures::pickerEnabled())->toBeFalse();
});

it('keeps the Picker off in fake mode even when OAuth is configured', function () {
    GoogleTesting::configureOAuth();

    expect(GoogleFeatures::fake())->toBeTrue()
        ->and(GoogleFeatures::pickerEnabled())->toBeFalse();
});

it('renders Google errors as JSON for API callers and as a toast otherwise', function () {
    $exception = new GoogleNotConfigured(['GOOGLE_SHARED_DRIVE_ID']);

    $json = $exception->render(Request::create('/x', 'GET', server: ['HTTP_ACCEPT' => 'application/json']));
    expect($json->getStatusCode())->toBe(503)
        ->and($json->getData(true))->toBe([
            'code' => 'google_not_configured',
            'message' => 'Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja.',
        ]);

    $redirect = $exception->render(Request::create('/x'));
    expect($redirect->isRedirect())->toBeTrue();
});
