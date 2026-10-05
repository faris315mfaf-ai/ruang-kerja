<?php

use App\Models\Company;
use App\Models\Division;
use App\Models\Team;
use Illuminate\Database\UniqueConstraintViolationException;

it('allows only one live board division per company', function () {
    $company = Company::factory()->create();
    Division::factory()->forCompany($company)->create(['code' => 'DIR', 'is_board' => true]);

    expect(fn () => Division::factory()->forCompany($company)->create(['code' => 'DIR2', 'is_board' => true]))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('allows a new board once the old one is soft-deleted, and boards in other companies', function () {
    $company = Company::factory()->create();
    $old = Division::factory()->forCompany($company)->create(['code' => 'DIR', 'is_board' => true]);
    $old->delete();

    Division::factory()->forCompany($company)->create(['code' => 'DIR2', 'is_board' => true]);
    Division::factory()->forCompany(Company::factory()->create())->create(['code' => 'DIR', 'is_board' => true]);

    expect(Division::query()->where('is_board', true)->count())->toBe(2);
});

it('keeps team codes unique within a division', function () {
    $division = Division::factory()->create();
    Team::factory()->for($division)->create(['code' => 'GDG']);

    expect(fn () => Team::factory()->for($division)->create(['code' => 'GDG']))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('allows teams without a code, the same code elsewhere, and reuse after soft delete', function () {
    $division = Division::factory()->create();
    Team::factory()->for($division)->count(2)->create(['code' => null]);
    Team::factory()->for(Division::factory()->forCompany($division->company)->create())->create(['code' => 'GDG']);
    Team::factory()->for($division)->create(['code' => 'GDG'])->delete();
    Team::factory()->for($division)->create(['code' => 'GDG']);

    expect(Team::withTrashed()->where('code', 'GDG')->count())->toBe(3);
});
