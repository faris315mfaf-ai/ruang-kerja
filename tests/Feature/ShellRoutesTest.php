<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Division;
use App\Models\Position;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('redirects the root url to the dashboard', function () {
    $this->get('/')->assertRedirect('/dashboard');
});

it('requires authentication for shell pages', function (string $uri) {
    $this->get($uri)->assertRedirect(route('login'));
})->with(['/dashboard', '/menu', '/inbox', '/tugas', '/absensi', '/pengajuan', '/persetujuan']);

it('renders the shell pages for a signed-in employee', function (string $uri, string $component) {
    $user = User::factory()->create();
    $user->assignRole(Role::Anggota->value);

    $this->actingAs($user)
        ->get($uri)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    ['/dashboard', 'dashboard'],
    ['/menu', 'menu'],
]);

it('shares branding and the global roles of the signed-in user', function () {
    $user = User::factory()->create();
    $user->assignRole([Role::KepalaDivisi->value, Role::Anggota->value]);

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('branding.name', config('branding.name'))
            ->where('branding.shortName', config('branding.short_name'))
            ->where('auth.user.id', $user->id)
            ->where('auth.roles', fn ($roles) => collect($roles)->sort()->values()->all() === ['anggota', 'kepala_divisi']),
        );
});

it('shares the organization of the signed-in user', function () {
    $division = Division::factory()->create(['name' => 'Operasional', 'code' => 'OPS']);
    $position = Position::factory()->create(['name' => 'Staf Operasional']);
    $user = User::factory()->inDivision($division)->create([
        'position_id' => $position->id,
        'avatar_url' => 'https://lh3.googleusercontent.test/a.png',
    ]);

    $user->hasRole(Role::Anggota); // loads the roles relation, which must not be shared

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.user.division.name', 'Operasional')
            ->where('auth.user.division.code', 'OPS')
            ->where('auth.user.position.name', 'Staf Operasional')
            ->where('auth.user.company.name', $user->company->name)
            ->where('auth.user.avatar', 'https://lh3.googleusercontent.test/a.png')
            ->where('branding.companyName', $user->company->name)
            ->missing('auth.user.google_id')
            ->missing('auth.user.password')
            ->missing('auth.user.roles'),
        );
});

it('titles placeholder pages in Indonesian', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/tugas')
        ->assertInertia(fn (Assert $page) => $page
            ->component('placeholder')
            ->where('title', 'Tugas saya'),
        );
});
