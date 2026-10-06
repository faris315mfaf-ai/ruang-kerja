<?php

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.prototype' => true]);
});

dataset('prototype pages', [
    ['/pratinjau', 'prototype/hub'],
    ['/catatan', 'notes/index'],
    ['/catatan/sop-onboarding', 'notes/show'],
    ['/rapat', 'meetings/index'],
    ['/rapat/baru', 'meetings/create'],
    ['/rapat/standup-ops', 'meetings/show'],
    ['/rapat/standup-ops/notulen', 'meetings/minutes'],
    ['/kalender', 'meetings/calendar'],
    ['/manajemen/jadwal', 'meetings/management-schedule'],
    ['/pengaturan/whatsapp', 'automation/whatsapp'],
    ['/otomasi', 'automation/rules'],
    ['/otomasi/berulang', 'automation/recurring'],
    ['/otomasi/template', 'automation/templates'],
    ['/kinerja', 'automation/performance'],
    ['/pratinjau/ponsel', 'mobile-app/index'],
    ['/pratinjau/ponsel/masuk', 'mobile-app/biometric-login'],
    ['/pratinjau/ponsel/integritas', 'mobile-app/integrity'],
    ['/pratinjau/ponsel/offline', 'mobile-app/offline'],
    ['/pratinjau/ponsel/widget', 'mobile-app/widget'],
    ['/pratinjau/ponsel/kunci', 'mobile-app/lock-screen'],
    ['/pratinjau/ponsel/aksi-cepat', 'mobile-app/quick-add'],
    ['/absensi/wajah', 'mobile-app/face-check-in'],
    ['/pengaturan/perangkat', 'mobile-app/devices'],
    ['/okr', 'okr/index'],
    ['/okr/q4-ops-1', 'okr/show'],
    ['/admin/mesin-absensi', 'okr/fingerprint-devices'],
]);

it('renders every preview page for a signed-in employee', function (string $uri, string $component) {
    $user = User::factory()->create();
    $user->assignRole(Role::Anggota->value);

    $this->actingAs($user)
        ->get($uri)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component($component)
            ->where('features.prototype', true));
})->with('prototype pages');

it('sends guests to the login page', function () {
    $this->get('/rapat')->assertRedirect(route('login'));
});

it('answers 404 when the prototype flag is off', function (string $uri) {
    config(['features.prototype' => false]);
    $user = User::factory()->create();
    $user->assignRole(Role::Anggota->value);

    $this->actingAs($user)->get($uri)->assertNotFound();
})->with(['/pratinjau', '/catatan', '/rapat', '/okr']);

it('shares the flag as off with the shell', function () {
    config(['features.prototype' => false]);
    $user = User::factory()->create();
    $user->assignRole(Role::Anggota->value);

    $this->actingAs($user)
        ->get('/menu')
        ->assertInertia(fn (Assert $page) => $page->where('features.prototype', false));
});
