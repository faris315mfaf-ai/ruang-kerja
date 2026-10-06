<?php

use App\Models\User;
use Database\Seeders\OrganizationSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(OrganizationSeeder::class);
});

it('shows the org chart to every role', function (string $email, bool $manageEmployees, bool $manageOrganization) {
    $viewer = User::query()->where('email', $email)->sole();

    $this->actingAs($viewer)
        ->get('/organisasi/struktur')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('organization/structure')
            ->where('chart.board.code', 'DIR')
            ->has('chart.divisions', 5)
            ->where('chart.stats.people', 24) // + Faris & Dio (Hiring demo accounts)
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
    'anggota' => ['anggota@demo.test', false, false],
]);

it('requires authentication', function () {
    $this->get('/organisasi/struktur')->assertRedirect(route('login'));
});
