<?php

use App\Domain\Auth\Rules\NotSameAsEmail;
use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\PasswordResetRequest;
use App\Models\User;
use App\Policies\PasswordResetRequestPolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->company = Company::factory()->create();
});

function resetRequestFor(User $user): PasswordResetRequest
{
    return PasswordResetRequest::query()->create([
        'company_id' => $user->company_id,
        'user_id' => $user->id,
        'email' => $user->email,
        'request_token_hash' => hash('sha256', $user->id),
        'expires_at' => now()->addDay(),
    ]);
}

it('is auto-discovered', function () {
    expect(Gate::getPolicyFor(PasswordResetRequest::class))->toBeInstanceOf(PasswordResetRequestPolicy::class);
});

it('applies the role × target matrix to view, decide and the list scope', function (Role $actorRole, Role $targetRole, bool $expected) {
    $actor = User::factory()->forCompany($this->company)->withRole($actorRole)->create();
    $target = User::factory()->forCompany($this->company)->withRole($targetRole)->create();
    $request = resetRequestFor($target);

    expect(Gate::forUser($actor)->allows('view', $request))->toBe($expected)
        ->and(Gate::forUser($actor)->allows('decide', $request))->toBe($expected)
        ->and(PasswordResetRequest::query()->visibleTo($actor)->whereKey($request->id)->exists())->toBe($expected);
})->with([
    'hr → anggota' => [Role::Hr, Role::Anggota, true],
    'hr → kepala divisi' => [Role::Hr, Role::KepalaDivisi, true],
    'hr → direksi' => [Role::Hr, Role::Direksi, true],
    'hr → hr' => [Role::Hr, Role::Hr, true],
    'hr → super admin' => [Role::Hr, Role::SuperAdmin, false],
    'super admin → anggota' => [Role::SuperAdmin, Role::Anggota, true],
    'super admin → super admin' => [Role::SuperAdmin, Role::SuperAdmin, true],
    'direksi → anggota' => [Role::Direksi, Role::Anggota, false],
    'kepala divisi → anggota' => [Role::KepalaDivisi, Role::Anggota, false],
    'anggota → anggota' => [Role::Anggota, Role::Anggota, false],
]);

it('never shows someone their own request to decide', function (Role $role) {
    $actor = User::factory()->forCompany($this->company)->withRole($role)->create();
    $request = resetRequestFor($actor);

    expect(Gate::forUser($actor)->allows('decide', $request))->toBeFalse()
        ->and(PasswordResetRequest::query()->visibleTo($actor)->count())->toBe(0);
})->with([Role::Hr, Role::SuperAdmin]);

it('hides other companies\' requests', function () {
    $hr = User::factory()->forCompany($this->company)->withRole(Role::Hr)->create();
    $foreign = User::factory()->forCompany(Company::factory()->create())->withRole(Role::Anggota)->create();
    $request = resetRequestFor($foreign);

    expect(Gate::forUser($hr)->allows('decide', $request))->toBeFalse()
        ->and(PasswordResetRequest::query()->visibleTo($hr)->count())->toBe(0);
});

it('denies an inactive HR', function () {
    $hr = User::factory()->forCompany($this->company)->inactive()->withRole(Role::Hr)->create();
    $request = resetRequestFor(User::factory()->forCompany($this->company)->withRole(Role::Anggota)->create());

    expect(Gate::forUser($hr)->allows('decide', $request))->toBeFalse();
});

it('rejects a password equal to the email or its local part, case-insensitively', function (string $password, bool $passes) {
    $validator = Validator::make(['password' => $password], ['password' => [new NotSameAsEmail('Rizky.Aditya@Kantor.test')]]);

    expect($validator->passes())->toBe($passes);
})->with([
    ['rizky.aditya@kantor.test', false],
    [' RIZKY.ADITYA ', false],
    ['rizky.aditya1', true],
    ['sandi-yang-lain', true],
]);
