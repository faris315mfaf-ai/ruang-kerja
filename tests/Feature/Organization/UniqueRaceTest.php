<?php

use App\Domain\Organization\Actions\RestoreDivision;
use App\Domain\Organization\Actions\RestoreTeam;
use App\Domain\Organization\Actions\SaveDivision;
use App\Domain\Organization\Actions\SaveTeam;
use App\Domain\Organization\Enums\Role;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Validation\ValidationException;

/*
 * Two saves can both pass the FormRequest's uniqueness checks; the unique
 * index then rejects the second one. That must surface as a validation error
 * (friendly message), never as a 500. The actions are called directly here,
 * exactly as the second request of such a race would reach them.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->hr = User::factory()->withRole(Role::Hr)->create();
});

function divisionData(array $overrides = []): array
{
    return ['name' => 'Keuangan', 'code' => 'KEU', 'parent_id' => null, 'head_user_id' => null, 'is_board' => false, ...$overrides];
}

function validationErrors(Closure $callback): array
{
    try {
        $callback();
    } catch (ValidationException $exception) {
        return $exception->errors();
    }

    throw new RuntimeException('Expected a validation error.');
}

it('turns a duplicate division code into a validation error', function () {
    app(SaveDivision::class)->handle($this->hr, divisionData());

    $errors = validationErrors(fn () => app(SaveDivision::class)->handle($this->hr, divisionData(['name' => 'Keuangan 2'])));

    expect($errors)->toBe(['code' => ['Kode KEU sudah dipakai divisi lain (termasuk yang sudah dihapus).']])
        ->and(Division::query()->count())->toBe(1);
});

it('turns a second board unit into a validation error, also on restore', function () {
    app(SaveDivision::class)->handle($this->hr, divisionData(['name' => 'Direksi', 'code' => 'DIR', 'is_board' => true]));

    expect(validationErrors(fn () => app(SaveDivision::class)->handle($this->hr, divisionData(['name' => 'Dewan', 'code' => 'DWN', 'is_board' => true]))))
        ->toHaveKey('is_board');

    $old = Division::factory()->create(['company_id' => $this->hr->company_id, 'code' => 'OLD', 'is_board' => false]);
    $old->delete();
    // Simulates the race: the trashed row became a board while another board exists.
    Division::withTrashed()->whereKey($old->id)->update(['is_board' => true]);

    expect(validationErrors(fn () => app(RestoreDivision::class)->handle(Division::withTrashed()->findOrFail($old->id))))
        ->toHaveKey('division');
});

it('turns a duplicate team code into a validation error, also on restore', function () {
    $division = Division::factory()->create(['company_id' => $this->hr->company_id]);
    $data = ['division_id' => $division->id, 'name' => 'Gudang', 'code' => 'GDG', 'lead_user_id' => null];
    app(SaveTeam::class)->handle($data);

    expect(validationErrors(fn () => app(SaveTeam::class)->handle([...$data, 'name' => 'Gudang 2'])))
        ->toBe(['code' => ['Kode GDG sudah dipakai tim lain di divisi ini.']])
        ->and(Team::query()->count())->toBe(1);
});

it('restores a team normally when its code is free', function () {
    $division = Division::factory()->create(['company_id' => $this->hr->company_id]);
    $team = Team::factory()->create(['division_id' => $division->id, 'code' => 'ABC']);
    $team->delete();
    Team::factory()->create(['division_id' => $division->id, 'code' => 'XYZ']);

    // No clash: restored normally.
    expect(app(RestoreTeam::class)->handle(Team::withTrashed()->findOrFail($team->id))->trashed())->toBeFalse();
});
