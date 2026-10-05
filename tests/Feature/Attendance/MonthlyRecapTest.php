<?php

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Domain\Organization\Enums\Role;
use App\Models\Division;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(F::at('2026-10-05 09:15'));
    Holiday::factory()->on('2026-09-25', 'Maulid Nabi Muhammad SAW')->create();
});

/**
 * September 2026 of one employee (Mon–Fri 08.00–17.00, tolerance 10 min).
 */
function seedSeptember(User $user): void
{
    $day = fn (string $date, S $status, array $extra = []) => AttendanceDay::factory()->for($user)->on($date)->status($status)->create($extra);
    $in = fn (string $date, string $time) => F::at("{$date} {$time}")->utc();

    $day('2026-09-01', S::Present, ['check_in_at' => $in('2026-09-01', '07:50'), 'check_out_at' => $in('2026-09-01', '17:02'), 'work_minutes' => 492]);
    $day('2026-09-02', S::Late, ['check_in_at' => $in('2026-09-02', '08:21'), 'late_minutes' => 11]);
    $day('2026-09-03', S::Late, ['check_in_at' => $in('2026-09-03', '08:15'), 'late_minutes' => 5, 'early_leave_minutes' => 30]);
    $day('2026-09-04', S::Wfh, ['check_in_at' => $in('2026-09-04', '08:00')]);
    $day('2026-09-07', S::Absent);
    $day('2026-09-08', S::Sick);
    $day('2026-09-09', S::Leave);
    $day('2026-09-10', S::Leave);
    $day('2026-09-11', S::Permit);
    $day('2026-09-14', S::BusinessTrip);
    $day('2026-09-15', S::NeedsCorrection, ['check_in_at' => $in('2026-09-15', '08:05')]);
    $day('2026-09-16', S::Present, ['check_in_at' => $in('2026-09-16', '07:58'), 'overtime_minutes' => 120, 'is_suspicious' => true]);
    $day('2026-09-17', S::EarlyLeave, ['check_in_at' => $in('2026-09-17', '07:55'), 'early_leave_minutes' => 20]);
    // Saturday, not scheduled: still counts as present, not as a work day.
    $day('2026-09-19', S::Present, ['check_in_at' => $in('2026-09-19', '09:00'), 'overtime_minutes' => 90]);
    $day('2026-09-25', S::Holiday);
    // Outside the month: ignored.
    $day('2026-08-31', S::Absent);
    $day('2026-10-01', S::Absent);
}

test('recap numbers match the test data', function () {
    $user = F::employee();
    seedSeptember($user);

    $recap = app(MonthlyRecap::class)->employee($user, RecapPeriod::forMonth('2026-09', now()));

    expect([
        'workDays' => $recap->workDays,
        'presentDays' => $recap->presentDays,
        'lateCount' => $recap->lateCount,
        'lateMinutes' => $recap->lateMinutes,
        'earlyLeaveCount' => $recap->earlyLeaveCount,
        'absentDays' => $recap->absentDays,
        'leaveDays' => $recap->leaveDays,
        'permitDays' => $recap->permitDays,
        'sickDays' => $recap->sickDays,
        'businessTripDays' => $recap->businessTripDays,
        'wfhDays' => $recap->wfhDays,
        'needsCorrectionDays' => $recap->needsCorrectionDays,
        'offDays' => $recap->offDays,
        'overtimeMinutes' => $recap->overtimeMinutes,
        'suspiciousDays' => $recap->suspiciousDays,
    ])->toBe([
        'workDays' => 21,          // 22 weekdays − Maulid (Fri 25 Sep)
        'presentDays' => 8,        // 1, 2, 3, 4, 15, 16, 17, 19
        'lateCount' => 2,
        'lateMinutes' => 16,
        'earlyLeaveCount' => 2,
        'absentDays' => 1,
        'leaveDays' => 2,
        'permitDays' => 1,
        'sickDays' => 1,
        'businessTripDays' => 1,
        'wfhDays' => 1,
        'needsCorrectionDays' => 1,
        'offDays' => 9,            // 8 weekend days + Maulid
        'overtimeMinutes' => 210,
        'suspiciousDays' => 1,
    ]);

    expect($recap->overtimeHours())->toBe(3.5)
        ->and($recap->expectedDays())->toBe(16)
        ->and($recap->attendanceRate())->toBe(50.0)
        ->and($recap->averageCheckInLabel())->toBe('08.11')
        ->and($recap->days)->toHaveCount(30);

    $kinds = collect($recap->days)->mapWithKeys(fn ($cell) => [$cell->date => $cell->kind]);

    expect($kinds['2026-09-02'])->toBe('late')
        ->and($kinds['2026-09-05'])->toBe('off')
        ->and($kinds['2026-09-25'])->toBe('holiday')
        ->and($kinds['2026-09-18'])->toBe('none')
        ->and($kinds['2026-09-19'])->toBe('present');
});

test('the running month counts only up to today', function () {
    $user = F::employee();
    AttendanceDay::factory()->for($user)->on('2026-10-01')->status(S::Present)->create(['check_in_at' => F::at('2026-10-01 07:59')->utc()]);

    $recap = app(MonthlyRecap::class)->employee($user, RecapPeriod::forMonth('2026-10', now()));
    $kinds = collect($recap->days)->mapWithKeys(fn ($cell) => [$cell->date => $cell->kind]);

    expect($recap->workDays)->toBe(3) // Thu 1, Fri 2, Mon 5
        ->and($recap->presentDays)->toBe(1)
        ->and($kinds['2026-10-05'])->toBe('none')
        ->and($kinds['2026-10-06'])->toBe('upcoming')
        ->and(RecapPeriod::forMonth('2026-10', now())->isRunning())->toBeTrue()
        ->and(RecapPeriod::forMonth('2026-11', now())->countedUntil)->toBeNull();
});

test('the company report follows the viewer scope, filters and the calendar of the month', function () {
    $operations = Division::factory()->create(['name' => 'Operasional']);
    $finance = Division::factory()->create(['name' => 'Keuangan']);
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($operations)->create();
    $hr = User::factory()->withRole(Role::Hr)->create();

    $rizky = F::employee();
    $rizky->update(['name' => 'Rizky Aditya', 'division_id' => $operations->id]);
    $fitri = F::employee();
    $fitri->update(['name' => 'Fitri Handayani', 'division_id' => $finance->id]);
    // A director without schedule or records is left out.
    User::factory()->create(['name' => 'Hendra Direktur']);

    seedSeptember($rizky);
    AttendanceDay::factory()->for($fitri)->on('2026-09-02')->status(S::Late)->create(['check_in_at' => F::at('2026-09-02 08:40')->utc(), 'late_minutes' => 30, 'overtime_minutes' => 60]);

    $recaps = app(MonthlyRecap::class);
    $period = RecapPeriod::forMonth('2026-09', now());

    $all = $recaps->report($hr, $period);
    expect(collect($all->rows)->map(fn ($row) => $row->user->name)->all())->toBe(['Fitri Handayani', 'Rizky Aditya'])
        ->and($all->calendarWorkDays)->toBe(21)
        ->and($all->weekendDays)->toBe(8)
        ->and($all->holidayDays)->toBe(1)
        ->and($all->totalLateCount())->toBe(3)
        ->and($all->totalOvertimeHours())->toBe(4.5)
        ->and($all->attendanceRate())->toBe(round(9 / (16 + 21) * 100, 1));

    expect(collect($recaps->report($kadiv, $period)->rows)->map(fn ($row) => $row->user->name)->all())->toBe(['Rizky Aditya'])
        ->and(collect($recaps->report($hr, $period, ['division_id' => $finance->id])->rows)->map(fn ($row) => $row->user->name)->all())->toBe(['Fitri Handayani'])
        ->and(collect($recaps->report($hr, $period, ['search' => 'rizk'])->rows)->map(fn ($row) => $row->user->name)->all())->toBe(['Rizky Aditya']);
});

test('the month parameter is validated', function (?string $value, string $expected) {
    expect(RecapPeriod::normalize($value, now()))->toBe($expected);
})->with([
    ['2026-09', '2026-09'],
    ['2026-13', '2026-10'],
    ['abc', '2026-10'],
    [null, '2026-10'],
    ['1999-01', '2026-10'],
]);
