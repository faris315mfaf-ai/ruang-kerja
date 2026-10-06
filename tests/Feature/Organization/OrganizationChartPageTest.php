<?php

use App\Models\User;
use Database\Seeders\OrganizationSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(OrganizationSeeder::class);
});

it('shows the org chart to every role except staff', function (string $email, bool $manageEmployees, bool $manageOrganization) {
    $viewer = User::query()->where('email', $email)->sole();

    $this->actingAs($viewer)
        ->get('/organisasi/struktur')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organization/structure')
            ->where('chart.board.code', 'DIR')
            ->has('chart.divisions', 5)
            ->where('chart.stats.people', 22)
            ->where('chart.divisions.1.code', 'OPS')
            ->where('chart.divisions.1.teams.0.lead.name', 'Sari Wulandari')
            ->where('can.manageEmployees', $manageEmployees)
            ->where('can.manageOrganization', $manageOrganization),
        );
})->with([
    'super_admin' => ['admin@demo.test', true, true],
    'direksi' => ['direksi@demo.test', false, false],
    'hr' => ['hr@demo.test', true, true],
    'kepala_divisi' => ['kadiv@demo.test', false, false],
]);

it('is a 404 for staff (anggota only, keputusan pemilik 6 Okt 2026)', function (string $email) {
    $viewer = User::query()->where('email', $email)->sole();

    expect($viewer->isStaffOnly())->toBeTrue();
    $this->actingAs($viewer)->get('/organisasi/struktur')->assertNotFound();
})->with(['anggota@demo.test', 'programmer@demo.test', 'maya.lestari@demo.test']);

it('requires authentication', function () {
    $this->get('/organisasi/struktur')->assertRedirect(route('login'));
});
