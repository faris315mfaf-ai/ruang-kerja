<?php

use App\Domain\Organization\Actions\SyncUserRoles;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Division;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use App\Policies\AuditLogPolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

function lastAudit(string $action): AuditLog
{
    return AuditLog::query()->where('action', $action)->latest('id')->firstOrFail();
}

it('logs an explicit action with actor, subject, ip and user agent', function () {
    $actor = User::factory()->create();
    $subject = User::factory()->create();
    $this->actingAs($actor);

    $this->app->instance('request', request()->duplicate(server: ['REMOTE_ADDR' => '10.1.2.3', 'HTTP_USER_AGENT' => 'PestBrowser/1.0']));

    $log = app(AuditLogger::class)->log('selfie.viewed', $subject, null, ['reason' => 'tinjauan']);

    expect($log->user_id)->toBe($actor->id)
        ->and($log->action)->toBe('selfie.viewed')
        ->and($log->auditable_type)->toBe(User::class)
        ->and($log->auditable_id)->toBe($subject->id)
        ->and($log->auditable?->is($subject))->toBeTrue()
        ->and($log->user?->is($actor))->toBeTrue()
        ->and($log->new_values)->toBe(['reason' => 'tinjauan'])
        ->and($log->ip_address)->toBe('10.1.2.3')
        ->and($log->user_agent)->toBe('PestBrowser/1.0');
});

it('records system changes without an actor', function () {
    $log = app(AuditLogger::class)->log('attendance.day_closed');

    expect($log->user_id)->toBeNull()->and($log->auditable_id)->toBeNull();
});

it('masks secrets recursively', function () {
    expect(AuditLogger::sanitize([
        'password' => 'rahasia',
        'nik' => '3171',
        'name' => 'Budi',
        'google' => ['refresh_token' => 'abc', 'scope' => 'drive'],
        'two_factor_secret' => null,
    ]))->toBe([
        'password' => '***',
        'nik' => '***',
        'name' => 'Budi',
        'google' => ['refresh_token' => '***', 'scope' => 'drive'],
        'two_factor_secret' => null,
    ]);
});

it('audits create, update, delete and restore of organization models', function (Closure $make, string $name, array $change) {
    /** @var Model $model */
    $model = $make();

    $created = lastAudit("{$name}.created");
    expect($created->auditable_id)->toBe($model->getKey())
        ->and($created->old_values)->toBeNull()
        ->and($created->new_values)->toHaveKey('id', $model->getKey());

    $model->update($change);
    $updated = lastAudit("{$name}.updated");
    $key = array_key_first($change);
    expect(array_keys($updated->new_values ?? []))->toBe([$key])
        ->and($updated->new_values[$key])->toBe($change[$key]);

    $model->delete();
    expect(lastAudit("{$name}.deleted")->old_values)->toHaveKey($key, $change[$key]);

    if (method_exists($model, 'restore')) {
        $model->restore();
        expect(lastAudit("{$name}.restored")->auditable_id)->toBe($model->getKey())
            ->and(AuditLog::query()->where('action', "{$name}.updated")->count())->toBe(1);
    }
})->with([
    'division' => [fn () => Division::factory()->create(), 'division', ['name' => 'Keuangan Baru']],
    'team' => [fn () => Team::factory()->create(), 'team', ['name' => 'Tim Baru']],
    'position' => [fn () => Position::factory()->create(), 'position', ['name' => 'Staf Baru']],
    'company' => [fn () => Company::factory()->create(), 'company', ['name' => 'PT Baru']],
    'user' => [fn () => User::factory()->create(), 'user', ['name' => 'Nama Baru']],
]);

it('stores before and after values of an employee change', function () {
    $hr = User::factory()->create();
    $employee = User::factory()->create(['status' => UserStatus::Active]);
    $this->actingAs($hr);

    $employee->update(['status' => UserStatus::Inactive]);

    $log = lastAudit('user.updated');
    expect($log->user_id)->toBe($hr->id)
        ->and($log->old_values)->toBe(['status' => 'active'])
        ->and($log->new_values)->toBe(['status' => 'inactive']);
});

it('never stores passwords or two-factor secrets', function () {
    $user = User::factory()->create(['password' => 'rahasia-lama']);
    $user->update(['password' => 'rahasia-baru']);
    $user->forceFill(['two_factor_secret' => encrypt('totp-secret')])->save();

    $json = AuditLog::query()->where('auditable_id', $user->id)->get()
        ->map(fn (AuditLog $log) => json_encode([$log->old_values, $log->new_values]))
        ->implode("\n");

    expect($json)->not->toContain('rahasia')
        ->and($json)->not->toContain('totp-secret')
        ->and($json)->not->toContain('$2y$')
        ->and(lastAudit('user.updated')->new_values)->toBe(['two_factor_secret' => '***']);
});

it('ignores login bookkeeping and theme changes', function () {
    $user = User::factory()->create();

    // remember_token is not fillable (set by the guard), so forceFill like the framework does.
    $user->forceFill(['last_login_at' => now(), 'remember_token' => 'abc', 'avatar_url' => 'https://example.test/a.png'])->save();

    expect(AuditLog::query()->where('action', 'user.updated')->exists())->toBeFalse();
});

it('writes nothing when model events are muted', function () {
    Model::withoutEvents(fn () => Division::factory()->create());

    expect(AuditLog::query()->where('action', 'division.created')->exists())->toBeFalse();
});

it('logs role changes once with the before and after role sets', function () {
    $this->seed(RoleSeeder::class);
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();
    $user = User::factory()->withRole(Role::Anggota)->create();

    $sync = app(SyncUserRoles::class);
    $sync->handle($user, [Role::KepalaDivisi, Role::Anggota], $admin);
    $sync->handle($user, [Role::Anggota, Role::KepalaDivisi], $admin); // unchanged → no row

    $logs = AuditLog::query()->where('action', 'user.roles_changed')->get();

    expect($logs)->toHaveCount(1)
        ->and($logs->first()?->user_id)->toBe($admin->id)
        ->and($logs->first()?->old_values)->toBe(['roles' => ['anggota']])
        ->and($logs->first()?->new_values)->toBe(['roles' => ['anggota', 'kepala_divisi']])
        ->and($user->fresh()?->hasRole(Role::KepalaDivisi))->toBeTrue();
});

it('refuses to modify an audit row', function () {
    $log = AuditLog::factory()->create();

    expect(fn () => $log->update(['action' => 'tampered']))->toThrow(LogicException::class);
});

it('lets only super admin view audit logs', function (Role $role, bool $expected) {
    $this->seed(RoleSeeder::class);
    $actor = User::factory()->withRole($role)->create();
    $log = AuditLog::factory()->create();
    $policy = new AuditLogPolicy;

    expect(Gate::getPolicyFor(AuditLog::class))->toBeInstanceOf(AuditLogPolicy::class)
        ->and(Gate::forUser($actor)->allows('viewAny', AuditLog::class))->toBe($expected)
        ->and(Gate::forUser($actor)->allows('view', $log))->toBe($expected)
        ->and($policy->create($actor))->toBeFalse()
        ->and($policy->update($actor, $log))->toBeFalse()
        ->and($policy->delete($actor, $log))->toBeFalse();
})->with([
    [Role::SuperAdmin, true],
    [Role::Direksi, false],
    [Role::Hr, false],
    [Role::KepalaDivisi, false],
    [Role::Anggota, false],
]);
