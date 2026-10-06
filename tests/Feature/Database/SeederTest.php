<?php

use App\Domain\Organization\Demo\DemoAccounts;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\Theme;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role as RoleModel;

it('seeds the five global roles idempotently', function () {
    $this->seed(RoleSeeder::class);
    $this->seed(RoleSeeder::class);

    expect(RoleModel::query()->where('guard_name', 'web')->orderBy('id')->pluck('name')->all())
        ->toBe(array_column(Role::cases(), 'value'));
});

it('seeds the demo users in the testing environment, idempotently', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    // 24 + Faris & Dio (Hiring final approvers, 6 Oct 2026).
    expect(User::query()->count())->toBe(26)
        ->and(RoleModel::query()->count())->toBe(5);

    foreach (DemoAccounts::all() as $account) {
        $user = User::query()->where('email', $account->email)->firstOrFail();

        expect($user->name)->toBe($account->name)
            ->and($user->getRoleNames()->all())->toBe([$account->role->value])
            ->and($user->email_verified_at)->not->toBeNull()
            ->and($user->theme)->toBe(Theme::System)
            ->and(Hash::check('password', $user->password))->toBeTrue();
    }
});

it('does not seed demo users in production', function () {
    app()->instance('env', 'production');

    $this->artisan('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true])
        ->assertSuccessful();

    expect(RoleModel::query()->count())->toBe(5)
        ->and(User::query()->count())->toBe(0);
});
