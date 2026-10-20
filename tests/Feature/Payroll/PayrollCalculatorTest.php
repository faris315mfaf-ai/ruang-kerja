<?php

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\Role;
use App\Domain\Payroll\Actions\LockPayrollPeriod;
use App\Domain\Payroll\Actions\SaveEmployeeWage;
use App\Domain\Payroll\Actions\SavePayrollRules;
use App\Domain\Payroll\Actions\UnlockPayrollPeriod;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Queries\PayrollCalculator;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Validation\ValidationException;
use Tests\Support\AttendanceFixtures as F;

/*
 * Gaji harian (keputusan pemilik 20 Okt 2026): daily wage × paid days.
 * October 2026 is closed (today = Mon 2 Nov 2026). The employee joined on
 * Mon 26 Oct, so only Mon 26 – Fri 30 Oct count (5 scheduled days):
 * Hadir, Terlambat, Sakit, Izin, and nothing recorded on Friday.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(F::at('2026-11-02 09:00'));
    $this->hr = User::factory()->withRole(Role::Hr)->create();
    $this->employee = User::factory()->create(['name' => 'Rina Gudang', 'joined_at' => '2026-10-26']);
    ShiftAssignment::factory()->for($this->employee)->for(Shift::factory()->create())->between('2026-01-01')->create();

    AttendanceDay::factory()->for($this->employee)->on('2026-10-26')->status(S::Present)->create(['check_in_at' => F::at('2026-10-26 07:55')->utc()]);
    AttendanceDay::factory()->for($this->employee)->on('2026-10-27')->status(S::Late)->create(['check_in_at' => F::at('2026-10-27 08:25')->utc(), 'late_minutes' => 15]);
    AttendanceDay::factory()->for($this->employee)->on('2026-10-28')->status(S::Sick)->create(['request_portion' => RequestPortion::Full]);
    AttendanceDay::factory()->for($this->employee)->on('2026-10-29')->status(S::Permit)->create(['request_portion' => RequestPortion::Full]);

    $this->period = RecapPeriod::forMonth('2026-10', now());
    $this->report = fn (): array => app(PayrollCalculator::class)->forMonth($this->hr, $this->period)->toArray();
});

test('default rules: worked and sick days are paid, permit is not, Friday is pending', function () {
    EmployeeWage::factory()->forEmployee($this->employee)->amount(100_000)->create();

    $report = ($this->report)();

    expect($report['rows'])->toHaveCount(1)
        ->and($report['rows'][0])->toMatchArray([
            'name' => 'Rina Gudang',
            'daily_wage' => 100_000,
            'wage_changed_in_period' => false,
            'missing_wage' => false,
            'present_days' => 2,
            'paid_leave_days' => 1,
            'unpaid_days' => 1,
            'absent_days' => 0,
            'late_count' => 1,
            'pending_days' => 1,
            'paid_days' => 3,
            'deduction' => 0,
            'total' => 300_000,
        ])
        ->and($report['totals'])->toMatchArray(['employees' => 1, 'total' => 300_000, 'paid_days' => 3, 'unpaid_days' => 1, 'pending_days' => 1])
        ->and($report['rules'])->toBe(['pay_leave' => true, 'pay_sick' => true, 'pay_permit' => false, 'late_deduction' => 0])
        ->and($report['period'])->toMatchArray(['month' => '2026-10', 'label' => 'Oktober 2026', 'locked' => false, 'workdays_total' => 22, 'workdays_elapsed' => 22]);
});

test('company rules: paid permit and a deduction per late day', function () {
    EmployeeWage::factory()->forEmployee($this->employee)->amount(100_000)->create();
    app(SavePayrollRules::class)->handle($this->hr, ['pay_leave' => true, 'pay_sick' => false, 'pay_permit' => true, 'late_deduction' => 10_000]);

    $row = ($this->report)()['rows'][0];

    expect($row)->toMatchArray([
        'paid_leave_days' => 1,
        'unpaid_days' => 1,
        'paid_days' => 3,
        'deduction' => 10_000,
        'total' => 290_000,
    ]);
});

test('a wage change mid-month applies from its effective date', function () {
    EmployeeWage::factory()->forEmployee($this->employee)->amount(100_000)->create();
    EmployeeWage::factory()->forEmployee($this->employee)->amount(120_000, '2026-10-28')->create();

    $row = ($this->report)()['rows'][0];

    // 26, 27 at 100.000; 28 (sick, paid) at 120.000.
    expect($row)->toMatchArray(['daily_wage' => 120_000, 'wage_changed_in_period' => true, 'total' => 320_000]);
});

test('a half-day leave with a check-in pays the whole day; Alpha is unpaid', function () {
    EmployeeWage::factory()->forEmployee($this->employee)->amount(100_000)->create();
    AttendanceDay::query()->whereDate('work_date', '2026-10-29')->update(['status' => S::Leave->value, 'request_portion' => RequestPortion::HalfDay->value, 'check_in_at' => F::at('2026-10-29 13:00')->utc()]);
    AttendanceDay::factory()->for($this->employee)->on('2026-10-30')->status(S::Absent)->create();

    $row = ($this->report)()['rows'][0];

    expect($row)->toMatchArray([
        'present_days' => 2.5,
        'paid_leave_days' => 1.5,
        'unpaid_days' => 0,
        'absent_days' => 1,
        'pending_days' => 0,
        'paid_days' => 4,
        'total' => 400_000,
    ]);
});

test('without a wage the paid days earn nothing and the row is flagged', function () {
    $row = ($this->report)()['rows'][0];

    expect($row)->toMatchArray(['daily_wage' => null, 'missing_wage' => true, 'paid_days' => 3, 'total' => 0]);
});

test('perlu koreksi and today before check-in are pending', function () {
    EmployeeWage::factory()->forEmployee($this->employee)->amount(100_000)->create();
    AttendanceDay::factory()->for($this->employee)->on('2026-10-30')->status(S::NeedsCorrection)->create(['check_in_at' => F::at('2026-10-30 08:00')->utc()]);
    $this->travelTo(F::at('2026-11-02 09:00'));

    $row = ($this->report)()['rows'][0];
    $november = app(PayrollCalculator::class)->forMonth($this->hr, RecapPeriod::forMonth('2026-11', now()))->toArray()['rows'][0];

    expect($row['pending_days'])->toBe(1)
        ->and($row['total'])->toBe(300_000)
        ->and($november)->toMatchArray(['pending_days' => 1, 'paid_days' => 0, 'total' => 0]);
});

test('a locked month keeps its snapshot; unlocking computes live again', function () {
    $wage = EmployeeWage::factory()->forEmployee($this->employee)->amount(100_000)->create();
    app(LockPayrollPeriod::class)->handle($this->hr, $this->period);

    // Changes after the lock (rules, a new wage row in a later month, attendance) do not move the snapshot.
    app(SavePayrollRules::class)->handle($this->hr, ['pay_leave' => true, 'pay_sick' => true, 'pay_permit' => true, 'late_deduction' => 50_000]);
    AttendanceDay::factory()->for($this->employee)->on('2026-10-30')->status(S::Present)->create(['check_in_at' => F::at('2026-10-30 07:55')->utc()]);

    $locked = ($this->report)();

    expect($locked['period'])->toMatchArray(['locked' => true, 'locked_by_name' => $this->hr->name])
        ->and($locked['rows'][0]['total'])->toBe(300_000)
        ->and($locked['rules']['late_deduction'])->toBe(0);

    // Wages dated in the locked month are refused, as is deleting a row of it.
    expect(fn () => app(SaveEmployeeWage::class)->handle($this->hr, $this->employee, 200_000, '2026-10-15'))
        ->toThrow(ValidationException::class, 'Periode gaji Oktober 2026 sudah dikunci. Buka kunci di Absensi › Gaji dulu.');

    app(UnlockPayrollPeriod::class)->handle($this->hr, $this->period);
    $live = ($this->report)();

    // Now 26, 27, 28 (sick), 29 (permit, paid), 30 = 5 × 100.000 − 1 late × 50.000.
    expect($live['period']['locked'])->toBeFalse()
        ->and($live['rows'][0]['total'])->toBe(450_000)
        ->and($wage->fresh())->not->toBeNull();
});
