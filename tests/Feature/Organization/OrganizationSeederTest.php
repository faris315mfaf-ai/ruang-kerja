<?php

use App\Domain\Organization\Demo\DemoCompany;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\ManagerHierarchy;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\EmployeeProfile;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\OrganizationSeeder;
use Illuminate\Support\Facades\Hash;

function demoUser(string $email): User
{
    return User::query()->where('email', $email)->with(['division', 'position', 'manager', 'team'])->firstOrFail();
}

it('seeds the demo organization idempotently', function () {
    $this->seed(OrganizationSeeder::class);
    $this->seed(OrganizationSeeder::class);

    $company = Company::query()->sole();

    expect($company->google_domain)->toBe(DemoCompany::GOOGLE_DOMAIN)
        ->and($company->name)->toBe(DemoCompany::name())
        ->and(Division::query()->orderBy('code')->pluck('code')->all())->toBe(['DIR', 'KEU', 'OPS', 'PMS', 'SDM'])
        ->and(Division::query()->where('is_board', true)->pluck('code')->all())->toBe(['DIR'])
        ->and(Team::query()->count())->toBe(2)
        ->and(Position::query()->count())->toBe(17)
        ->and(User::query()->count())->toBe(22)
        ->and(EmployeeProfile::query()->count())->toBe(22)
        ->and(User::query()->where('status', UserStatus::Inactive)->count())->toBe(1)
        ->and(User::query()->where('status', UserStatus::Resigned)->count())->toBe(1);
});

it('places the demo accounts in the organization', function () {
    $this->seed(OrganizationSeeder::class);

    $kadiv = demoUser('kadiv@demo.test');
    $anggota = demoUser('anggota@demo.test');
    $hr = demoUser('hr@demo.test');
    $direksi = demoUser('direksi@demo.test');
    $admin = demoUser('admin@demo.test');

    expect($kadiv->name)->toBe('Dimas Pratama')
        ->and($kadiv->division?->code)->toBe('OPS')
        ->and($kadiv->position?->name)->toBe('Kepala Divisi Operasional')
        ->and($kadiv->division?->head_user_id)->toBe($kadiv->id)
        ->and($kadiv->manager?->is($direksi))->toBeTrue()
        ->and($anggota->name)->toBe('Rizky Aditya')
        ->and($anggota->division?->code)->toBe('OPS')
        ->and($anggota->manager?->is($kadiv))->toBeTrue()
        ->and($hr->name)->toBe('Hana Pratiwi')
        ->and($hr->division?->code)->toBe('SDM')
        ->and($direksi->name)->toBe('Hendra Wijaya')
        ->and($direksi->position?->name)->toBe('Direktur Utama')
        ->and($direksi->division?->is_board)->toBeTrue()
        ->and($direksi->manager_id)->toBeNull()
        ->and($admin->hasRole(Role::SuperAdmin))->toBeTrue()
        ->and(demoUser('nadia.putri@demo.test')->team?->name)->toBe('Tim Gudang');
});

it('keeps demo credentials and gives regular employees no password', function () {
    $this->seed(OrganizationSeeder::class);

    expect(Hash::check('password', (string) demoUser('kadiv@demo.test')->password))->toBeTrue()
        ->and(demoUser('bayu.saputra@demo.test')->password)->toBeNull()
        ->and(demoUser('bayu.saputra@demo.test')->hasRole(Role::Anggota))->toBeTrue()
        ->and(demoUser('agus.setiawan@demo.test')->hasRole(Role::KepalaDivisi))->toBeTrue();
});

it('builds a consistent reporting line without cycles', function () {
    $this->seed(OrganizationSeeder::class);
    $hierarchy = new ManagerHierarchy;

    $users = User::query()->with('manager')->get();

    foreach ($users as $user) {
        $chain = $hierarchy->chainOf($user);

        // Everybody except the Direktur Utama and the system admin ends at the Direktur Utama.
        if ($user->manager_id !== null) {
            expect(end($chain)->email)->toBe('direksi@demo.test');
        }

        expect($user->company_id)->toBe(Company::query()->value('id'));
    }

    // Each division head reports to Direksi.
    Division::query()->where('is_board', false)->with('head.manager.division')->get()
        ->each(fn (Division $division) => expect($division->head?->manager?->division?->is_board)->toBeTrue());
});

it('writes no audit rows when run through DatabaseSeeder', function () {
    $this->seed(DatabaseSeeder::class);

    expect(AuditLog::query()->count())->toBe(0)
        ->and(User::query()->count())->toBe(22);
});
