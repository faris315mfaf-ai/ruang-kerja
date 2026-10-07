<?php

use App\Domain\Organization\Enums\Role;
use App\Http\Middleware\RestrictCredentialRoutes;
use App\Models\User;
use Database\Seeders\RoleSeeder;

it('renders the Arus 404 page in Indonesian', function () {
    $this->get('/halaman-yang-tidak-ada')
        ->assertNotFound()
        ->assertSee('Galat 404')
        ->assertSee('Halaman tidak ditemukan')
        ->assertSee('Ke beranda')
        ->assertDontSee('Not Found');
});

it('shows the specific reason of an app 403 on the Arus error page', function () {
    $this->seed(RoleSeeder::class);
    $user = User::factory()->create();
    $user->assignRole(Role::Anggota->value);

    // Two-factor management (and its password confirmation) is Super Admin only.
    $this->actingAs($user)
        ->get(route('password.confirm'))
        ->assertForbidden()
        ->assertSee('Akses ditolak')
        ->assertSee('Galat 403')
        ->assertSee(RestrictCredentialRoutes::MESSAGE);
});
