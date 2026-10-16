<?php

use App\Domain\Privacy\Services\PrivacyPolicy;
use App\Models\User;
use Illuminate\Support\Facades\File;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Versioned privacy policy: config version + Markdown in resources/markdown.
 * Guests get the standalone public Blade page (no account, no Inertia shell);
 * signed-in employees get the in-app Inertia page.
 */

it('is public without login and renders the standalone Blade page', function () {
    config(['privacy.policy.version' => '1.2', 'privacy.policy.effective_date' => '2026-11-01', 'attendance.selfie.retention_months' => 9]);

    $this->get('/kebijakan-privasi')
        ->assertOk()
        ->assertViewIs('privacy.public')
        ->assertSee('Kebijakan Privasi')
        ->assertSee('biometrik', false)
        ->assertSee('Versi 1.2')
        ->assertSee('dihapus otomatis setelah 9 bulan')
        ->assertSee('UU PDP')
        // The draft status stays out of the page (owner decision lives in comments only).
        ->assertDontSee('menunggu persetujuan pemilik');
});

it('shows the in-app Inertia page with the company name when signed in', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/kebijakan-privasi')->assertInertia(fn (Assert $page) => $page
        ->component('privacy/policy')
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
    // config/attendance.php: ATTENDANCE_CONSENT_VERSION falls back to PRIVACY_POLICY_VERSION,
    // and the literal fallback must stay in step with config/privacy.php (bumped together).
    $attendance = file_get_contents(config_path('attendance.php'));
    $privacy = file_get_contents(config_path('privacy.php'));

    expect($attendance)->toContain("env('ATTENDANCE_CONSENT_VERSION', env('PRIVACY_POLICY_VERSION', ");

    preg_match("/env\('PRIVACY_POLICY_VERSION', '([^']+)'\)/", $attendance, $fromAttendance);
    preg_match("/env\('PRIVACY_POLICY_VERSION', '([^']+)'\)/", $privacy, $fromPrivacy);

    expect($fromAttendance[1] ?? null)->not->toBeNull()
        ->and($fromAttendance[1])->toBe($fromPrivacy[1])
        ->and(config('attendance.consent.version'))->toBe(config('privacy.policy.version'));
});

it('describes the WhatsApp group, OpenStreetMap and offline storage processing', function () {
    $markdown = app(PrivacyPolicy::class)->markdown();

    expect($markdown)
        ->toContain('grup WhatsApp')
        ->toContain('di luar kendali aplikasi')
        ->toContain('Nominatim')
        ->toContain('OpenStreetMap')
        ->toContain('SQLCipher')
        ->toContain('72 jam');

    // The public (guest) page is a separate Blade template: it must say the same.
    $this->get('/kebijakan-privasi')
        ->assertOk()
        ->assertSee('grup WhatsApp', false)
        ->assertSee('Nominatim', false)
        ->assertSee('SQLCipher', false)
        ->assertSee('72 jam', false);
});
