<?php

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\LazyLoadingViolationException;

it('is strict outside production', function () {
    expect(Model::preventsLazyLoading())->toBeTrue()
        ->and(Model::preventsSilentlyDiscardingAttributes())->toBeTrue()
        ->and(Model::preventsAccessingMissingAttributes())->toBeTrue();
});

it('throws on lazy loading (N+1) outside production', function () {
    User::factory()->count(2)->create();

    $users = User::query()->get();

    expect(fn () => $users->first()?->company)->toThrow(LazyLoadingViolationException::class);
});

it('keeps freshly created users complete for strict attribute access', function () {
    $user = User::factory()->create();

    expect($user->division_id)->toBeNull()
        ->and($user->manager_id)->toBeNull()
        ->and($user->last_login_at)->toBeNull();
});
