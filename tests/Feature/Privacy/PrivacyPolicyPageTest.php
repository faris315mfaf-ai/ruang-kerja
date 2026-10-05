<?php

use App\Domain\Privacy\Services\PrivacyPolicy;
use App\Models\User;
use Illuminate\Support\Facades\File;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Versioned privacy policy: config version + Markdown in resources/markdown.
 */

it('is public and shows the configured version and the rendered Markdown', function () {
    config(['privacy.policy.version' => '1.2', 'privacy.policy.effective_date' => '2026-11-01', 'attendance.selfie.retention_months' => 9]);

    $this->get('/kebijakan-privasi')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('privacy/policy')
        ->where('version', '1.2')
        ->where('effective_date', '2026-11-01')
        ->where('signedIn', false)
        ->where('html', fn (string $html): bool => str_contains($html, '<h2>1. Ringkasan</h2>')
            && str_contains($html, 'dihapus otomatis setelah 9 bulan')
            && str_contains($html, 'UU PDP')
            // Editor comments and unfilled placeholders never reach the page.
            && ! str_contains($html, 'Placeholder yang tersedia')
            && ! str_contains($html, '{{')));
});

it('fills in the signed-in user\'s company and shows the app shell', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/kebijakan-privasi')->assertInertia(fn (Assert $page) => $page
        ->where('signedIn', true)
        ->where('html', fn (string $html): bool => str_contains($html, e($user->company->name))));
});

it('escapes raw HTML in the owner-edited Markdown', function () {
    $path = storage_path('framework/testing/privacy-policy-test.md');
    File::ensureDirectoryExists(dirname($path));
    File::put($path, "## Judul\n\n<script>alert(1)</script>\n\n[tautan](javascript:alert(1)) versi {{versi}}");
    config(['privacy.policy.path' => $path, 'privacy.policy.version' => '3.0']);

    $html = app(PrivacyPolicy::class)->html();

    expect($html)->toContain('<h2>Judul</h2>')
        ->toContain('&lt;script&gt;')
        ->not->toContain('<script>')
        ->not->toContain('javascript:')
        ->toContain('versi 3.0');

    File::delete($path);
});

it('drives the attendance consent version by default', function () {
    // config/attendance.php: ATTENDANCE_CONSENT_VERSION falls back to PRIVACY_POLICY_VERSION.
    $config = file_get_contents(config_path('attendance.php'));

    expect($config)->toContain("env('ATTENDANCE_CONSENT_VERSION', env('PRIVACY_POLICY_VERSION', '1.0'))")
        ->and(config('attendance.consent.version'))->toBe(config('privacy.policy.version'));
});
