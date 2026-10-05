<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Dashboard Direksi attendance widget: "belum check-in" only counts people who
 * are scheduled today (bulk ScheduleSnapshot via TodayAttendance), the same
 * numbers as Dashboard HR.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    // Monday 5 Oct 2026, 10.00 WIB.
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00', 'Asia/Jakarta'));
    $this->shift = Shift::factory()->create();
});

function portfolioEmployee(Shift $shift, ?AttendanceStatus $status = null, array $day = [], bool $scheduled = true): User
{
    $user = User::factory()->create();

    if ($scheduled) {
        ShiftAssignment::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id]);
    }

    if ($status !== null) {
        AttendanceDay::factory()->for($user)->on('2026-10-05')->status($status)->create(['shift_id' => $shift->id, ...$day]);
    }

    return $user;
}

it('counts present, away and not checked in among the people scheduled today', function () {
    $direksi = User::factory()->withRole(Role::Direksi)->create(); // no shift: not expected
    $at = CarbonImmutable::parse('2026-10-05 07:55', 'Asia/Jakarta')->utc();

    portfolioEmployee($this->shift, AttendanceStatus::Present, ['check_in_at' => $at]);
    portfolioEmployee($this->shift, AttendanceStatus::Late, ['check_in_at' => $at, 'late_minutes' => 10]);
    portfolioEmployee($this->shift, AttendanceStatus::Leave, ['request_portion' => 'full']);
    portfolioEmployee($this->shift, AttendanceStatus::Leave, ['request_portion' => 'half_day', 'check_in_at' => $at]); // present
    portfolioEmployee($this->shift); // scheduled, not checked in
    portfolioEmployee($this->shift, scheduled: false); // no shift today: not counted
    portfolioEmployee($this->shift)->forceFill(['status' => UserStatus::Inactive])->save(); // inactive

    $this->actingAs($direksi)->get('/portofolio')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('attendance', ['present' => 3, 'total' => 5, 'on_leave' => 1, 'not_checked_in' => 1]));
});

it('does not expect anyone on a weekend', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-04 10:00', 'Asia/Jakarta'));
    $direksi = User::factory()->withRole(Role::Direksi)->create();
    portfolioEmployee($this->shift);

    $this->actingAs($direksi)->get('/portofolio')->assertInertia(fn (Assert $page) => $page
        ->where('attendance', ['present' => 0, 'total' => 0, 'on_leave' => 0, 'not_checked_in' => 0]));
});
