<?php

use App\Domain\Organization\Enums\Role;
use App\Models\GoogleAccount;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('shows the connection status without tokens', function () {
    $user = User::factory()->withRole(Role::Anggota)->create();
    GoogleAccount::factory()->for($user)->create(['email' => 'rizky@kantor.co.id', 'access_token' => 'ya29.hidden']);

    $response = $this->actingAs($user)->get('/settings/google')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/google')
            ->where('google.drive_enabled', true)
            ->where('google.fake', true)
            ->where('google.connect_enabled', false)
            ->where('google.account.email', 'rizky@kantor.co.id')
            ->where('google.account.has_drive_access', true)
            ->where('google.account.needs_reconnect', false)
            ->where('google.missing_settings', []));

    expect($response->getContent())->not->toContain('ya29.hidden');
});

it('lists missing env keys for the Super Admin only', function (Role $role, bool $seesKeys) {
    GoogleTesting::disable();
    $user = User::factory()->withRole($role)->create();

    $this->actingAs($user)->get('/settings/google')
        ->assertInertia(fn (Assert $page) => $page
            ->where('google.drive_enabled', false)
            ->where('google.account', null)
            ->where('google.missing_settings', $seesKeys
                ? ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_IMPERSONATE_USER', 'GOOGLE_SHARED_DRIVE_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
                : []));
})->with([
    [Role::SuperAdmin, true],
    [Role::Direksi, false],
    [Role::Hr, false],
    [Role::KepalaDivisi, false],
    [Role::Anggota, false],
]);
