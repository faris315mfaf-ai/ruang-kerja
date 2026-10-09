<?php

it('serves the full Digital Asset Links statement when the certificate is configured', function () {
    $fingerprint = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

    config([
        'branding.android.package' => 'store.spkd.ruangkerja',
        'branding.android.cert_sha256' => $fingerprint,
    ]);

    $response = $this->getJson('/.well-known/assetlinks.json');

    $response->assertOk()
        ->assertHeader('content-type', 'application/json')
        ->assertJsonCount(1)
        ->assertJsonPath('0.relation.0', 'delegate_permission/common.handle_all_urls')
        ->assertJsonPath('0.target.namespace', 'android_app')
        ->assertJsonPath('0.target.package_name', 'store.spkd.ruangkerja')
        ->assertJsonPath('0.target.sha256_cert_fingerprints.0', $fingerprint);
});

it('returns an empty array while no certificate fingerprint is configured', function () {
    config(['branding.android.cert_sha256' => '']);

    $this->getJson('/.well-known/assetlinks.json')
        ->assertOk()
        ->assertHeader('content-type', 'application/json')
        ->assertExactJson([]);
});

it('lists every comma-separated certificate fingerprint, uppercased', function () {
    $a = 'aa:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff';
    $b = 'BB:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';
    config(['branding.android.cert_sha256' => " {$a} , {$b} ,,"]);

    Log::spy();

    $this->getJson('/.well-known/assetlinks.json')
        ->assertOk()
        ->assertJsonPath('0.target.sha256_cert_fingerprints', [strtoupper($a), $b]);

    Log::assertNotLogged('android.assetlinks invalid fingerprint');
});

it('drops malformed fingerprints and logs a warning instead of serving them', function () {
    config(['branding.android.cert_sha256' => 'AA:11, BB:22']);
    Log::spy();

    $this->getJson('/.well-known/assetlinks.json')
        ->assertOk()
        ->assertExactJson([]);

    Log::assertLogged('android.assetlinks invalid fingerprint');
});

it('stays reachable for guests without authentication', function () {
    config(['branding.android.cert_sha256' => 'AA:11']);

    // Registered inside the `web` group (routes/android.php), so a session
    // cookie may ride along; no auth middleware guards it, CSRF never applies
    // to GET, and moving it out (like /health) is an integrator-only change.
    $this->getJson('/.well-known/assetlinks.json')
        ->assertOk()
        ->assertHeader('content-type', 'application/json');

    $this->assertGuest();
});
