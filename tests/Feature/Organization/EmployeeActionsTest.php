<?php

use App\Domain\Google\Jobs\RevokeGoogleToken;
use App\Domain\Organization\Actions\CreateEmployee;
use App\Domain\Organization\Actions\DeactivateEmployee;
use App\Domain\Organization\Actions\ReactivateEmployee;
use App\Domain\Organization\Actions\UpdateEmployee;
use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Data\EmployeeFilters;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Services\EmployeeDirectory;
use App\Http\Presenters\EmployeePresenter;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\GoogleAccount;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->hr = User::factory()->withRole(Role::Hr)->create();
});

function employeeData(array $roles = [Role::Anggota], ?string $nik = null): EmployeeData
{
    return new EmployeeData(
        name: 'Bayu',
        email: 'bayu@example.test',
        divisionId: null,
        teamId: null,
        positionId: null,
        managerId: null,
        workMode: WorkMode::Office,
        joinedAt: null,
        roles: $roles,
        nik: $nik,
    );
}

it('refuses to grant super_admin inside CreateEmployee even without the form (defense in depth)', function () {
    expect(fn () => app(CreateEmployee::class)->handle($this->hr, employeeData([Role::SuperAdmin])))
        ->toThrow(AuthorizationException::class);

    // The whole transaction was rolled back.
    expect(User::query()->where('email', 'bayu@example.test')->exists())->toBeFalse();
});

it('refuses HR granting direksi/hr or changing own roles inside the actions (defense in depth)', function (Role $role) {
    expect(fn () => app(CreateEmployee::class)->handle($this->hr, employeeData([$role])))
        ->toThrow(AuthorizationException::class);

    $bayu = app(CreateEmployee::class)->handle($this->hr, employeeData());

    expect(fn () => app(UpdateEmployee::class)->handle($this->hr, $bayu, employeeData([$role])))
        ->toThrow(AuthorizationException::class)
        ->and($bayu->refresh()->hasRole($role))->toBeFalse();

    $selfData = new EmployeeData(
        name: $this->hr->name, email: $this->hr->email, divisionId: null, teamId: null, positionId: null,
        managerId: null, workMode: WorkMode::Office, joinedAt: null, roles: [Role::Hr, Role::KepalaDivisi], nik: null,
    );

    expect(fn () => app(UpdateEmployee::class)->handle($this->hr, $this->hr, $selfData))
        ->toThrow(AuthorizationException::class);
})->with([Role::Direksi, Role::Hr]);

it('defaults new employees to the anggota role and skips an empty profile', function () {
    $bayu = app(CreateEmployee::class)->handle($this->hr, employeeData([]));

    expect($bayu->getRoleNames()->all())->toBe(['anggota'])
        ->and($bayu->profile()->exists())->toBeFalse();
});

it('audits profile changes by field name only and ignores an unchanged NIK', function () {
    $bayu = app(CreateEmployee::class)->handle($this->hr, employeeData(nik: '3201010101010001'));
    $before = AuditLog::query()->where('action', 'employee_profile.updated')->count();

    app(UpdateEmployee::class)->handle($this->hr, $bayu, employeeData(nik: '3201010101010001'));

    expect(AuditLog::query()->where('action', 'employee_profile.updated')->count())->toBe($before);

    app(UpdateEmployee::class)->handle($this->hr, $bayu, employeeData(nik: '3201010101010002'));

    $log = AuditLog::query()->where('action', 'employee_profile.updated')->latest('created_at')->orderByDesc('id')->first();
    expect($log?->new_values)->toBe(['fields' => ['nik']]);
});

it('deactivates without moving reports unless asked, and rejects the active status', function () {
    $bayu = User::factory()->create();
    $report = User::factory()->managedBy($bayu)->create();

    expect(app(DeactivateEmployee::class)->handle($this->hr, $bayu, UserStatus::Inactive, 'Cuti panjang'))->toBe(0)
        ->and($report->refresh()->manager_id)->toBe($bayu->id)
        ->and($bayu->refresh()->status)->toBe(UserStatus::Inactive);

    // Exactly one audit row for the status change (no generic user.updated).
    expect(AuditLog::query()->where('auditable_id', $bayu->id)->pluck('action')->all())->toEqualCanonicalizing(['user.created', 'user.deactivated']);

    expect(fn () => app(DeactivateEmployee::class)->handle($this->hr, $bayu, UserStatus::Active, 'x'))
        ->toThrow(InvalidArgumentException::class);
});

it('reactivates idempotently', function () {
    $bayu = User::factory()->inactive()->create();

    app(ReactivateEmployee::class)->handle($this->hr, $bayu);
    app(ReactivateEmployee::class)->handle($this->hr, $bayu);

    expect($bayu->refresh()->status)->toBe(UserStatus::Active)
        ->and(AuditLog::query()->where('action', 'user.reactivated')->count())->toBe(1);
});

it('masks NIK keeping the last four digits', function () {
    expect(EmployeePresenter::maskNik('3201010101019876'))->toBe('••••••••••••9876')
        ->and(EmployeePresenter::maskNik(null))->toBeNull()
        ->and(EmployeePresenter::maskNik(''))->toBeNull();
});

it('parses list filters defensively', function () {
    $filters = EmployeeFilters::fromRequest(Request::create('/', 'GET', [
        'search' => '  bayu  ', 'role' => 'hr', 'status' => 'resigned', 'sort' => 'joined_at', 'direction' => 'desc', 'per_page' => '25',
    ]));

    expect($filters->toArray())->toBe([
        'search' => 'bayu', 'division' => null, 'role' => 'hr', 'status' => 'resigned',
        'sort' => 'joined_at', 'direction' => 'desc', 'per_page' => 25,
    ]);
});

it('escapes LIKE wildcards in the search term', function () {
    User::factory()->create(['name' => 'Persen 100%']);
    User::factory()->create(['name' => 'Biasa']);

    $result = app(EmployeeDirectory::class)->query($this->hr, new EmployeeFilters(search: '%'))->pluck('name')->all();

    expect($result)->toBe(['Persen 100%']);
});

describe('leadership clean-up', function () {
    beforeEach(function () {
        $this->ops = Division::factory()->create(['code' => 'OPS']);
        $this->keu = Division::factory()->forCompany($this->ops->company)->create(['code' => 'KEU']);
        $this->head = User::factory()->withRole(Role::KepalaDivisi)->inDivision($this->ops)->create();
        $this->ops->forceFill(['head_user_id' => $this->head->id])->saveQuietly();
        $this->gudang = Team::factory()->for($this->ops)->ledBy($this->head)->create();
        $this->kirim = Team::factory()->for($this->ops)->create();
        $this->head->update(['team_id' => $this->gudang->id]);
        $this->member = User::factory()->inDivision($this->ops)->create();
    });

    function moveData(User $user, ?string $divisionId, ?string $teamId, array $roles = []): EmployeeData
    {
        return new EmployeeData(
            name: $user->name, email: $user->email, divisionId: $divisionId, teamId: $teamId, positionId: null,
            managerId: null, workMode: WorkMode::Office, joinedAt: null, roles: $roles, nik: null,
        );
    }

    it('clears the division head and team lead (audited) and revokes Google on deactivation', function () {
        Queue::fake();
        GoogleAccount::factory()->for($this->head)->create(['refresh_token' => '1//refresh']);

        app(DeactivateEmployee::class)->handle($this->hr, $this->head, UserStatus::Resigned, 'Resign');

        expect($this->ops->refresh()->head_user_id)->toBeNull()
            ->and($this->gudang->refresh()->lead_user_id)->toBeNull()
            ->and(GoogleAccount::query()->where('user_id', $this->head->id)->exists())->toBeFalse();

        $divisionLog = AuditLog::query()->where('auditable_id', $this->ops->id)->where('action', 'division.updated')->sole();
        $teamLog = AuditLog::query()->where('auditable_id', $this->gudang->id)->where('action', 'team.updated')->sole();

        expect($divisionLog->old_values)->toBe(['head_user_id' => $this->head->id])
            ->and($divisionLog->new_values)->toBe(['head_user_id' => null])
            ->and($divisionLog->user_id)->toBe($this->hr->id)
            ->and($teamLog->new_values)->toBe(['lead_user_id' => null]);

        Queue::assertPushed(RevokeGoogleToken::class, fn (RevokeGoogleToken $job) => $job->token === '1//refresh');

        // The visibility scope no longer sees a led division through the stale head.
        $this->head->status = UserStatus::Active;
        $this->head->syncRoles([Role::Anggota->value]);
        expect($this->head->ledDivisionIds())->toBe([]);
    });

    it('releases the old division and team when the head moves elsewhere', function () {
        app(UpdateEmployee::class)->handle($this->hr, $this->head, moveData($this->head, $this->keu->id, null));

        expect($this->ops->refresh()->head_user_id)->toBeNull()
            ->and($this->gudang->refresh()->lead_user_id)->toBeNull()
            ->and(AuditLog::query()->where('auditable_id', $this->ops->id)->where('action', 'division.updated')->count())->toBe(1);
    });

    it('releases only the team lead when moving to another team of the same division', function () {
        app(UpdateEmployee::class)->handle($this->hr, $this->head, moveData($this->head, $this->ops->id, $this->kirim->id));

        expect($this->ops->refresh()->head_user_id)->toBe($this->head->id)
            ->and($this->gudang->refresh()->lead_user_id)->toBeNull();
    });

    it('keeps leadership on unrelated edits', function () {
        app(UpdateEmployee::class)->handle($this->hr, $this->head, moveData($this->head, $this->ops->id, $this->gudang->id));

        expect($this->ops->refresh()->head_user_id)->toBe($this->head->id)
            ->and($this->gudang->refresh()->lead_user_id)->toBe($this->head->id)
            ->and(AuditLog::query()->whereIn('action', ['division.updated', 'team.updated'])->count())->toBe(0);
    });
});

describe('manager cycles under concurrency', function () {
    function managerData(User $user, ?string $managerId): EmployeeData
    {
        return new EmployeeData(
            name: $user->name, email: $user->email, divisionId: null, teamId: null, positionId: null,
            managerId: $managerId, workMode: WorkMode::Office, joinedAt: null, roles: [], nik: null,
        );
    }

    it('rejects a reporting cycle inside UpdateEmployee even when validation was bypassed', function () {
        $a = User::factory()->create();
        $b = User::factory()->forCompany($a->company)->managedBy($a)->create();
        $c = User::factory()->forCompany($a->company)->managedBy($b)->create();

        expect(fn () => app(UpdateEmployee::class)->handle($this->hr, $a, managerData($a, $c->id)))
            ->toThrow(ValidationException::class, 'Atasan ini akan membuat siklus atasan (bawahan tidak boleh menjadi atasan).');

        expect(fn () => app(UpdateEmployee::class)->handle($this->hr, $a, managerData($a, $a->id)))
            ->toThrow(ValidationException::class, 'Karyawan tidak bisa menjadi atasan dirinya sendiri.');

        expect($a->refresh()->manager_id)->toBeNull();
    });

    it('serializes reporting-line changes per company with an advisory lock', function () {
        $a = User::factory()->create();
        $b = User::factory()->forCompany($a->company)->create();

        DB::enableQueryLog();
        app(UpdateEmployee::class)->handle($this->hr, $b, managerData($b, $a->id));

        $locks = collect(DB::getQueryLog())->filter(fn (array $query) => str_contains($query['query'], 'pg_advisory_xact_lock'));

        expect($locks)->toHaveCount(1)
            ->and($b->refresh()->manager_id)->toBe($a->id);
    });

    it('keeps unrelated edits free of the lock', function () {
        $a = User::factory()->create();
        $b = User::factory()->forCompany($a->company)->managedBy($a)->create();

        DB::enableQueryLog();
        app(UpdateEmployee::class)->handle($this->hr, $b, managerData($b, $a->id));

        expect(collect(DB::getQueryLog())->filter(fn (array $query) => str_contains($query['query'], 'pg_advisory_xact_lock')))->toHaveCount(0);
    });
});
