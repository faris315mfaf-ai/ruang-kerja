<?php

use App\Domain\Organization\Rules\ValidManager;
use App\Domain\Organization\Services\ManagerHierarchy;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\Validator;

beforeEach(function () {
    $this->hierarchy = new ManagerHierarchy;
});

it('allows removing the manager', function () {
    $user = User::factory()->create();

    expect($this->hierarchy->wouldCreateCycle($user, null))->toBeFalse();
});

it('rejects a user managing themselves', function () {
    $user = User::factory()->create();

    expect($this->hierarchy->wouldCreateCycle($user, $user))->toBeTrue();
});

it('rejects A → B → A', function () {
    $a = User::factory()->create();
    $b = User::factory()->managedBy($a)->create();

    expect($this->hierarchy->wouldCreateCycle($a, $b))->toBeTrue();
});

it('rejects deeper chains', function () {
    $a = User::factory()->create();
    $b = User::factory()->managedBy($a)->create();
    $c = User::factory()->managedBy($b)->create();
    $d = User::factory()->managedBy($c)->create();

    expect($this->hierarchy->wouldCreateCycle($a, $d))->toBeTrue()
        ->and($this->hierarchy->wouldCreateCycle($b, $d))->toBeTrue();
});

it('accepts valid managers', function () {
    $a = User::factory()->create();
    $b = User::factory()->managedBy($a)->create();
    $c = User::factory()->create();

    expect($this->hierarchy->wouldCreateCycle($c, $b))->toBeFalse()
        ->and($this->hierarchy->wouldCreateCycle($b, $c))->toBeFalse()
        ->and($this->hierarchy->wouldCreateCycle($b, $a))->toBeFalse();
});

it('rejects managers whose chain already loops', function () {
    $x = User::factory()->create();
    $y = User::factory()->managedBy($x)->create();
    $x->forceFill(['manager_id' => $y->id])->saveQuietly();
    $newcomer = User::factory()->create();

    expect($this->hierarchy->wouldCreateCycle($newcomer, $x))->toBeTrue();
});

it('lists the management chain nearest first', function () {
    $ceo = User::factory()->create();
    $head = User::factory()->managedBy($ceo)->create();
    $staff = User::factory()->managedBy($head)->create();

    expect(array_map(fn (User $u) => $u->id, $this->hierarchy->chainOf($staff)))->toBe([$head->id, $ceo->id])
        ->and($this->hierarchy->chainOf($ceo))->toBe([]);
});

function validateManager(?User $subject, mixed $managerId, string $companyId): array
{
    return Validator::make(
        ['manager_id' => $managerId],
        ['manager_id' => ['nullable', new ValidManager($subject, $companyId)]],
    )->errors()->get('manager_id');
}

it('validates manager input with Indonesian messages', function () {
    $a = User::factory()->create();
    $b = User::factory()->managedBy($a)->create();
    $inactive = User::factory()->inactive()->create();
    $foreign = User::factory()->forCompany(Company::factory()->create())->create();

    expect(validateManager($a, null, $a->company_id))->toBe([])
        ->and(validateManager(null, $a->id, $a->company_id))->toBe([])
        ->and(validateManager($b, $a->id, $a->company_id))->toBe([])
        ->and(validateManager($a, $b->id, $a->company_id))->toBe(['Atasan ini akan membuat siklus atasan (bawahan tidak boleh menjadi atasan).'])
        ->and(validateManager($a, $a->id, $a->company_id))->toBe(['Karyawan tidak bisa menjadi atasan dirinya sendiri.'])
        ->and(validateManager($b, $inactive->id, $a->company_id))->toBe(['Atasan langsung harus karyawan aktif.'])
        ->and(validateManager($b, $foreign->id, $a->company_id))->toBe(['Atasan langsung tidak ditemukan.'])
        ->and(validateManager($b, '01JXXXXXXXXXXXXXXXXXXXXXXX', $a->company_id))->toBe(['Atasan langsung tidak ditemukan.']);
});

it('accepts an unchanged inactive manager but rejects switching to one', function () {
    $oldBoss = User::factory()->inactive()->create();
    $staff = User::factory()->forCompany($oldBoss->company)->managedBy($oldBoss)->create();
    $otherInactive = User::factory()->forCompany($oldBoss->company)->inactive()->create();

    expect(validateManager($staff, $oldBoss->id, $staff->company_id))->toBe([])
        ->and(validateManager($staff, $otherInactive->id, $staff->company_id))->toBe(['Atasan langsung harus karyawan aktif.'])
        ->and(validateManager(null, $oldBoss->id, $staff->company_id))->toBe(['Atasan langsung harus karyawan aktif.']);
});
