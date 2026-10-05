<?php

use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Company;
use App\Models\Division;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->hr = User::factory()->withRole(Role::Hr)->create();
    $this->shift = Shift::factory()->create(['name' => 'Reguler']);
    $this->travelTo(F::at('2026-10-05 09:00'));
});

test('HR assigns a weekly pattern to a whole division, including sub-divisions', function () {
    $division = Division::factory()->create();
    $sub = Division::factory()->childOf($division)->create();
    $members = User::factory()->count(2)->inDivision($division)->create();
    $subMember = User::factory()->inDivision($sub)->create();
    User::factory()->inactive()->inDivision($division)->create();
    User::factory()->create(); // other division

    $this->actingAs($this->hr)->post(route('admin.attendance.assignments.store'), [
        'target' => 'division',
        'division_id' => $division->id,
        'shift_id' => $this->shift->id,
        'weekdays' => [1, 2, 3, 4, 5],
        'valid_from' => '2026-10-05',
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect(ShiftAssignment::query()->pluck('user_id')->sort()->values()->all())
        ->toBe($members->push($subMember)->pluck('id')->sort()->values()->all());
});

test('HR assigns a pattern to selected employees with a work mode', function () {
    $user = User::factory()->workMode(WorkMode::Hybrid)->create();

    $this->actingAs($this->hr)->post(route('admin.attendance.assignments.store'), [
        'target' => 'employees',
        'user_ids' => [$user->id],
        'shift_id' => $this->shift->id,
        'weekdays' => [5],
        'valid_from' => '2026-10-05',
        'work_mode_override' => 'wfh',
    ])->assertSessionHasNoErrors();

    $friday = app(ScheduleResolver::class)->forDate($user, F::at('2026-10-09'));

    expect($friday->workMode)->toBe(WorkMode::Wfh)->and($friday->isWorkday())->toBeTrue();
});

test('a new open-ended pattern supersedes the old one covering the same days', function () {
    $user = User::factory()->create();
    $old = ShiftAssignment::factory()->for($user)->for($this->shift)->between('2026-01-01')->create();
    $later = ShiftAssignment::factory()->for($user)->for($this->shift)->between('2026-11-01')->create();
    $partial = ShiftAssignment::factory()->for($user)->for($this->shift)->weekdays([6])->between('2026-01-01')->create();
    $early = Shift::factory()->hours('07:00', '16:00')->create(['name' => 'Pagi']);

    $this->actingAs($this->hr)->post(route('admin.attendance.assignments.store'), [
        'target' => 'employees', 'user_ids' => [$user->id], 'shift_id' => $early->id,
        'weekdays' => [1, 2, 3, 4, 5], 'valid_from' => '2026-10-12',
    ])->assertSessionHasNoErrors();

    expect($old->fresh()?->valid_until?->toDateString())->toBe('2026-10-11')
        ->and(ShiftAssignment::query()->whereKey($later->id)->exists())->toBeFalse()
        ->and($partial->fresh()?->valid_until)->toBeNull()
        ->and(app(ScheduleResolver::class)->forDate($user, F::at('2026-10-12'))->shift?->name)->toBe('Pagi');
});

test('a temporary pattern applies during its period, then the regular one resumes', function () {
    $user = User::factory()->create();
    ShiftAssignment::factory()->for($user)->for($this->shift)->between('2026-01-01')->create();
    $night = Shift::factory()->night()->create();

    $this->actingAs($this->hr)->post(route('admin.attendance.assignments.store'), [
        'target' => 'employees', 'user_ids' => [$user->id], 'shift_id' => $night->id,
        'weekdays' => [1, 2, 3, 4, 5], 'valid_from' => '2026-10-12', 'valid_until' => '2026-10-16',
    ])->assertSessionHasNoErrors();

    $resolver = app(ScheduleResolver::class);

    expect($resolver->forDate($user, F::at('2026-10-14'))->shift?->id)->toBe($night->id)
        ->and($resolver->forDate($user, F::at('2026-10-19'))->shift?->id)->toBe($this->shift->id);
});

test('pattern input is validated', function () {
    $this->actingAs($this->hr)->post(route('admin.attendance.assignments.store'), [
        'target' => 'employees', 'user_ids' => [], 'shift_id' => 'nope', 'weekdays' => [0, 8],
        'valid_from' => '2026-10-12', 'valid_until' => '2026-10-01',
    ])->assertSessionHasErrors(['user_ids', 'shift_id', 'weekdays.0', 'weekdays.1', 'valid_until']);
});

test('HR sets a date override (other shift, WFH or day off) and removes it', function () {
    $user = User::factory()->create();

    $this->actingAs($this->hr)->post(route('admin.attendance.assignments.override'), [
        'user_id' => $user->id, 'date' => '2026-10-07', 'shift_id' => $this->shift->id, 'work_mode_override' => 'wfh',
    ])->assertSessionHasNoErrors();

    $this->actingAs($this->hr)->post(route('admin.attendance.assignments.override'), [
        'user_id' => $user->id, 'date' => '2026-10-07', 'shift_id' => null,
    ])->assertSessionHasNoErrors();

    $override = ShiftAssignment::query()->sole();

    expect($override->override_date?->toDateString())->toBe('2026-10-07')
        ->and($override->shift_id)->toBeNull()
        ->and(app(ScheduleResolver::class)->forDate($user, F::at('2026-10-07'))->isWorkday())->toBeFalse();

    $this->actingAs($this->hr)->delete(route('admin.attendance.assignments.destroy', $override))->assertRedirect();
    expect(ShiftAssignment::query()->count())->toBe(0);
});

test('employees of another company cannot be assigned', function () {
    $foreign = User::factory()->forCompany(Company::factory()->create())->create();

    $this->actingAs($this->hr)->post(route('admin.attendance.assignments.override'), [
        'user_id' => $foreign->id, 'date' => '2026-10-07',
    ])->assertSessionHasErrors('user_id');
});

test('the assignments page lists employees with their patterns and overrides', function () {
    $division = Division::factory()->create(['name' => 'Operasional', 'code' => 'OPS']);
    $user = User::factory()->inDivision($division)->create(['name' => 'Rizky Aditya']);
    ShiftAssignment::factory()->for($user)->for($this->shift)->between('2026-01-01')->create();
    ShiftAssignment::factory()->for($user)->override('2026-10-09')->create();

    $this->actingAs($this->hr)->get(route('admin.attendance.assignments.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/attendance/assignments')
            ->where('employees', fn ($employees) => collect($employees)->contains(fn ($e) => $e['name'] === 'Rizky Aditya'
                && $e['divisionCode'] === 'OPS'
                && $e['patterns'][0]['daysLabel'] === 'Sen–Jum'
                && $e['overrides'][0]['date'] === '2026-10-09'
                && $e['overrides'][0]['shiftName'] === null))
            ->has('shifts', 1)
            ->has('workModes', 4));
});
