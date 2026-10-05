<?php

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    Http::preventStrayRequests();
});

it('lists what is missing and fails when nothing is configured', function () {
    GoogleTesting::disable();

    $this->artisan('ruangkerja:google-check')
        ->expectsOutputToContain('GOOGLE_SERVICE_ACCOUNT_JSON')
        ->expectsOutputToContain('Isi kunci di atas pada .env')
        ->expectsOutputToContain('Ada pemeriksaan yang gagal')
        ->assertFailed();
});

it('checks the token, the Shared Drive and write access', function () {
    GoogleTesting::useRealServiceAccount();
    GoogleTesting::configureOAuth();
    Http::fake([
        ...GoogleTesting::tokenResponse(),
        'www.googleapis.com/drive/v3/drives/*' => Http::response(['id' => GoogleTesting::SHARED_DRIVE, 'name' => 'RuangKerja']),
        'www.googleapis.com/drive/v3/files/folder-check*' => Http::response(null, 204),
        'www.googleapis.com/drive/v3/files*' => Http::response(['id' => 'folder-check', 'name' => 'x', 'mimeType' => 'application/vnd.google-apps.folder']),
    ]);

    $this->artisan('ruangkerja:google-check', ['--write' => true])
        ->expectsOutputToContain('ruangkerja@project.iam.gserviceaccount.com')
        ->expectsOutputToContain('RuangKerja')
        ->expectsOutputToContain('folder uji dibuat lalu dihapus')
        ->expectsOutputToContain('Semua pemeriksaan lolos')
        ->doesntExpectOutputToContain('PRIVATE KEY')
        ->doesntExpectOutputToContain('oauth-client-secret')
        ->assertSuccessful();

    Http::assertSent(fn (Request $request) => $request->method() === 'DELETE' && str_contains($request->url(), 'folder-check'));
});

it('explains missing domain-wide delegation', function () {
    GoogleTesting::useRealServiceAccount();
    GoogleTesting::configureOAuth();
    Http::fake(['oauth2.googleapis.com/token' => Http::response(['error' => 'unauthorized_client'], 401)]);

    $this->artisan('ruangkerja:google-check')
        ->expectsOutputToContain('Delegasi tingkat domain')
        ->assertFailed();
});

it('explains a Shared Drive the admin cannot see', function () {
    GoogleTesting::useRealServiceAccount();
    GoogleTesting::configureOAuth();
    Http::fake([
        ...GoogleTesting::tokenResponse(),
        'www.googleapis.com/*' => Http::response(['error' => ['errors' => [['reason' => 'notFound']], 'message' => 'Shared drive not found']], 404),
    ]);

    $this->artisan('ruangkerja:google-check')
        ->expectsOutputToContain('anggota Shared Drive')
        ->assertFailed();
});
