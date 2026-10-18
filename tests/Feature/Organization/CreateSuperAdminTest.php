<?php

use App\Domain\Organization\Actions\CreateSuperAdmin;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

it('creates the company and the first super admin on a fresh install', function () {
    expect(Company::query()->count())->toBe(0);

    $user = app(CreateSuperAdmin::class)->handle('Admin@Perusahaan.co.id', 'Admin Sistem', 'Sandi-Rahasia-123', 'PT Contoh');

    $company = Company::query()->sole();

    expect($company->name)->toBe('PT Contoh')
        ->and($company->google_domain)->toBe('perusahaan.co.id')
        ->and($user->email)->toBe('admin@perusahaan.co.id')
        ->and($user->company_id)->toBe($company->id)
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(Hash::check('Sandi-Rahasia-123', (string) $user->password))->toBeTrue()
        ->and($user->hasRole(Role::SuperAdmin->value))->toBeTrue()
        ->and(AuditLog::query()->where('action', 'user.roles_changed')->exists())->toBeTrue();
});

it('promotes an existing user and keeps their other roles', function () {
    $existing = User::factory()->withRole(Role::Hr)->create();

    app(CreateSuperAdmin::class)->handle($existing->email, $existing->name, 'Sandi-Rahasia-123');

    $existing->refresh();

    expect($existing->hasRole(Role::SuperAdmin->value))->toBeTrue()
        ->and($existing->hasRole(Role::Hr->value))->toBeTrue()
        ->and(Company::query()->count())->toBe(1);
});

it('is available as an artisan command with a generated password', function () {
    $this->artisan('ruangkerja:create-super-admin', [
        'email' => 'admin@perusahaan.co.id',
        '--generate-password' => true,
    ])->assertSuccessful();

    expect(User::query()->where('email', 'admin@perusahaan.co.id')->sole()->isSuperAdmin())->toBeTrue();
});

it('rejects an invalid e-mail', function () {
    $this->artisan('ruangkerja:create-super-admin', ['email' => 'bukan-email', '--generate-password' => true])
        ->assertFailed();

    expect(User::query()->count())->toBe(0);
});

describe('with several companies (Fase 1 multi-perusahaan)', function () {
    beforeEach(function () {
        $this->first = Company::factory()->create(['name' => 'PT Pertama', 'google_domain' => 'pertama.co.id']);
        $this->second = Company::factory()->create(['name' => 'PT Kedua', 'google_domain' => 'kedua.co.id']);
    });

    it('requires choosing the company', function () {
        $this->artisan('ruangkerja:create-super-admin', ['email' => 'admin@kedua.co.id', '--generate-password' => true])
            ->expectsOutputToContain('--company')
            ->assertFailed();

        expect(User::query()->where('email', 'admin@kedua.co.id')->exists())->toBeFalse();
    });

    it('places the admin in the company chosen by id, domain or name', function (string $key) {
        $this->artisan('ruangkerja:create-super-admin', ['email' => 'admin@kedua.co.id', '--company' => $key === 'id' ? $this->second->id : $key, '--generate-password' => true])
            ->assertSuccessful();

        expect(User::query()->where('email', 'admin@kedua.co.id')->sole()->company_id)->toBe($this->second->id);
    })->with(['id', 'KEDUA.co.id', 'pt kedua']);

    it('rejects an unknown company', function () {
        $this->artisan('ruangkerja:create-super-admin', ['email' => 'admin@kedua.co.id', '--company' => 'tidak-ada.co.id', '--generate-password' => true])
            ->assertFailed();
    });

    it('creates a new company only when asked explicitly', function () {
        $this->artisan('ruangkerja:create-super-admin', ['email' => 'admin@ketiga.co.id', '--new-company' => 'PT Ketiga', '--generate-password' => true])
            ->assertSuccessful();

        $user = User::query()->where('email', 'admin@ketiga.co.id')->sole();

        expect($user->company?->name)->toBe('PT Ketiga')
            ->and($user->company?->google_domain)->toBe('ketiga.co.id')
            ->and(Company::query()->count())->toBe(3);
    });

    it('never moves an existing user to another company', function () {
        $existing = User::factory()->forCompany($this->first)->create(['email' => 'hana@pertama.co.id']);

        $this->artisan('ruangkerja:create-super-admin', ['email' => $existing->email, '--company' => $this->second->id, '--generate-password' => true])
            ->assertFailed();

        app(CreateSuperAdmin::class)->handle($existing->email, 'Hana', 'Sandi-Rahasia-123');

        expect($existing->refresh()->company_id)->toBe($this->first->id)
            ->and($existing->isSuperAdmin())->toBeTrue();
    });
});
