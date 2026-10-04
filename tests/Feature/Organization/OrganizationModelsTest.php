<?php

use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Company;
use App\Models\Division;
use App\Models\EmployeeProfile;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('wires the organization relationships', function () {
    $company = Company::factory()->create();
    $board = Division::factory()->forCompany($company)->board()->create();
    $ops = Division::factory()->forCompany($company)->create(['name' => 'Operasional', 'code' => 'ops', 'parent_id' => null]);
    $sub = Division::factory()->childOf($ops)->create(['code' => 'OPS2']);
    $position = Position::factory()->create(['company_id' => $company->id, 'name' => 'Kepala Divisi Operasional', 'level' => 2]);

    $director = User::factory()->forCompany($company)->inDivision($board)->create();
    $head = User::factory()->inDivision($ops)->managedBy($director)->create(['position_id' => $position->id]);
    $ops->update(['head_user_id' => $head->id]);
    $team = Team::factory()->ledBy($head)->create(['division_id' => $ops->id, 'name' => 'Tim Gudang', 'code' => 'gdg']);
    $member = User::factory()->inDivision($ops, $team)->managedBy($head)->create();
    $profile = EmployeeProfile::factory()->create(['user_id' => $member->id]);

    $member->refresh();

    expect($member->company->is($company))->toBeTrue()
        ->and($member->division?->is($ops))->toBeTrue()
        ->and($member->team?->is($team))->toBeTrue()
        ->and($member->manager?->is($head))->toBeTrue()
        ->and($member->profile?->is($profile))->toBeTrue()
        ->and($head->directReports->modelKeys())->toBe([$member->id])
        ->and($head->position?->is($position))->toBeTrue()
        ->and($head->ledDivisions->modelKeys())->toBe([$ops->id])
        ->and($head->ledTeams->modelKeys())->toBe([$team->id])
        ->and($ops->fresh()?->head?->is($head))->toBeTrue()
        ->and($ops->code)->toBe('OPS')
        ->and($team->code)->toBe('GDG')
        ->and($ops->children->modelKeys())->toBe([$sub->id])
        ->and($sub->parent?->is($ops))->toBeTrue()
        ->and($ops->teams->modelKeys())->toBe([$team->id])
        ->and($ops->members->modelKeys())->toEqualCanonicalizing([$head->id, $member->id])
        ->and($board->is_board)->toBeTrue()
        ->and($company->divisions()->count())->toBe(3)
        ->and($company->positions->modelKeys())->toBe([$position->id])
        ->and($position->users->modelKeys())->toBe([$head->id])
        ->and($team->members->modelKeys())->toBe([$member->id])
        ->and($team->lead?->is($head))->toBeTrue()
        ->and($profile->user->is($member))->toBeTrue();
});

it('applies sensible defaults to new users', function () {
    $user = User::factory()->create();

    expect($user->status)->toBe(UserStatus::Active)
        ->and($user->work_mode)->toBe(WorkMode::Office)
        ->and($user->isActive())->toBeTrue()
        ->and($user->company_id)->not->toBeNull()
        ->and(User::factory()->inactive()->create()->isActive())->toBeFalse()
        ->and(User::factory()->resigned()->create()->isActive())->toBeFalse();
});

it('reuses the single company across factories', function () {
    $first = User::factory()->create();
    $second = User::factory()->create();
    $division = Division::factory()->create();

    expect(Company::query()->count())->toBe(1)
        ->and($second->company_id)->toBe($first->company_id)
        ->and($division->company_id)->toBe($first->company_id);
});

it('keeps division codes unique per company', function () {
    $company = Company::factory()->create();
    Division::factory()->forCompany($company)->create(['code' => 'KEU']);

    // Savepoint so PostgreSQL can continue after the expected violation.
    expect(fn () => DB::transaction(fn () => Division::factory()->forCompany($company)->create(['code' => 'keu'])))
        ->toThrow(QueryException::class);

    $other = Company::factory()->create();
    expect(Division::factory()->forCompany($other)->create(['code' => 'KEU'])->code)->toBe('KEU');
});

it('rejects lower-case division codes at the database level', function () {
    $company = Company::factory()->create();

    expect(fn () => DB::transaction(fn () => DB::table('divisions')->insert([
        'id' => (string) str()->ulid(),
        'company_id' => $company->id,
        'name' => 'Keuangan',
        'code' => 'keu',
        'is_board' => false,
    ])))->toThrow(QueryException::class);
});

it('stores the NIK encrypted and hides it from serialization', function () {
    $profile = EmployeeProfile::factory()->create(['nik' => '3171234567890001']);

    $raw = DB::table('employee_profiles')->where('user_id', $profile->user_id)->value('nik');

    expect($raw)->not->toBe('3171234567890001')
        ->and($raw)->not->toContain('3171234567890001')
        ->and($profile->fresh()?->nik)->toBe('3171234567890001')
        ->and($profile->toArray())->not->toHaveKey('nik');
});

it('normalizes the company google domain and matches emails', function () {
    $company = Company::factory()->create(['google_domain' => ' Perusahaan.CO.ID ']);

    expect($company->google_domain)->toBe('perusahaan.co.id')
        ->and($company->ownsEmail('Budi@perusahaan.co.id'))->toBeTrue()
        ->and($company->ownsEmail('budi@perusahaan.co.id.evil.test'))->toBeFalse()
        ->and($company->ownsEmail('budi@gmail.com'))->toBeFalse();
});

it('allows users without a password (Google sign-in only)', function () {
    $user = User::factory()->create(['password' => null]);

    expect($user->fresh()?->password)->toBeNull();
});

it('hides the google id from serialization', function () {
    $user = User::factory()->create(['google_id' => '1234567890']);

    expect($user->toArray())->not->toHaveKey('google_id');
});

it('collects a division with all of its descendants', function () {
    $root = Division::factory()->create();
    $child = Division::factory()->childOf($root)->create();
    $grandChild = Division::factory()->childOf($child)->create();
    Division::factory()->create();

    expect(Division::withDescendantIds([$root->id]))->toEqualCanonicalizing([$root->id, $child->id, $grandChild->id]);
});
