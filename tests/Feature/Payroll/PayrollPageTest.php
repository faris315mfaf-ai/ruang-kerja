<?php

use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Payroll\Exports\DailyPayrollExport;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Domain\Payroll\Models\PayrollRule;
use App\Models\AuditLog;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Facades\Excel;
use Tests\Support\AttendanceFixtures as F;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Absensi › Gaji (keputusan pemilik 20 Okt 2026): page, wages, rules, lock,
 * export, access. Today = Mon 2 Nov 2026; October is closed.
 */

beforeEach(function () {
    $this->travelTo(F::at('2026-11-02 09:00'));
    $this->home = homeWorld();
    $this->employee = F::employee();
    $this->employee->forceFill(['name' => 'Rina Gudang', 'division_id' => $this->home->division->id])->save();
    EmployeeWage::factory()->forEmployee($this->employee)->amount(100_000)->create();
    AttendanceDay::factory()->for($this->employee)->on('2026-10-30')->status(S::Present)->create(['check_in_at' => F::at('2026-10-30 07:55')->utc()]);
});

test('HR sees the month report with rules, period and manage rights', function () {
    $this->actingAs($this->home->hr)
        ->get(route('attendance.payroll.index', ['bulan' => '2026-10', 'q' => 'Rina']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('attendance/payroll')
            ->where('period.month', '2026-10')
            ->where('filters.q', 'Rina')
            ->where('can.manage', true)
            ->has('report.rows', 1)
            ->where('report.rows.0.name', 'Rina Gudang')
            ->where('report.rows.0.present_days', 1)
            ->where('report.rows.0.total', 100_000)
            ->where('report.rules.pay_permit', false)
            ->where('report.period.locked', false));
});

test('HR sets a wage, reads the history and deletes a row', function () {
    $this->actingAs($this->home->hr)
        ->put(route('attendance.payroll.wages.update', ['employee' => $this->employee->id]), ['daily_wage' => 125_000, 'effective_from' => '2026-11-01', 'note' => 'Kenaikan November'])
        ->assertSessionHasNoErrors();
    // Same date again replaces the row.
    $this->actingAs($this->home->hr)
        ->put(route('attendance.payroll.wages.update', ['employee' => $this->employee->id]), ['daily_wage' => 130_000, 'effective_from' => '2026-11-01'])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->home->hr)
        ->getJson(route('attendance.payroll.wages.index', ['employee' => $this->employee->id]))
        ->assertOk()
        ->assertJsonPath('employee.name', 'Rina Gudang')
        ->assertJsonPath('current', 130_000)
        ->assertJsonCount(2, 'wages')
        ->assertJsonPath('wages.0.daily_wage', 130_000)
        ->assertJsonPath('wages.0.effective_from', '2026-11-01')
        ->assertJsonPath('wages.0.created_by_name', $this->home->hr->name)
        ->assertJsonPath('wages.0.locked', false)
        ->assertJsonPath('can.manage', true);

    $wage = EmployeeWage::query()->whereDate('effective_from', '2026-11-01')->sole();
    $this->actingAs($this->home->hr)->delete(route('attendance.payroll.wages.destroy', ['wage' => $wage->id]))->assertSessionHasNoErrors();

    expect(EmployeeWage::query()->where('user_id', $this->employee->id)->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'payroll.wage_saved')->count())->toBe(2)
        ->and(AuditLog::query()->where('action', 'payroll.wage_deleted')->count())->toBe(1);
});

test('wage and rule input is validated', function () {
    $this->actingAs($this->home->hr)
        ->put(route('attendance.payroll.wages.update', ['employee' => $this->employee->id]), ['daily_wage' => -5, 'effective_from' => '01/11/2026'])
        ->assertSessionHasErrors(['daily_wage', 'effective_from']);
    $this->actingAs($this->home->hr)
        ->put(route('attendance.payroll.wages.update', ['employee' => $this->employee->id]), ['daily_wage' => 100_000_001, 'effective_from' => '2026-11-01'])
        ->assertSessionHasErrors('daily_wage');
    $this->actingAs($this->home->hr)
        ->put(route('attendance.payroll.rules.update'), ['pay_leave' => 'ya', 'pay_sick' => true, 'pay_permit' => false, 'late_deduction' => -1])
        ->assertSessionHasErrors(['pay_leave', 'late_deduction']);
});

test('HR saves the rules, locks and unlocks a month', function () {
    $this->actingAs($this->home->hr)
        ->put(route('attendance.payroll.rules.update'), ['pay_leave' => true, 'pay_sick' => true, 'pay_permit' => true, 'late_deduction' => 20_000])
        ->assertSessionHasNoErrors();

    expect(PayrollRule::query()->find($this->home->company->id)?->toRules())
        ->toBe(['pay_leave' => true, 'pay_sick' => true, 'pay_permit' => true, 'late_deduction' => 20_000]);

    $this->actingAs($this->home->hr)->post(route('attendance.payroll.lock', ['month' => '2026-10']))->assertSessionHasNoErrors();
    $this->actingAs($this->home->hr)->post(route('attendance.payroll.lock', ['month' => '2026-10']))->assertSessionHasErrors('month');

    $period = PayrollPeriod::query()->sole();
    expect($period->isLocked())->toBeTrue()
        ->and($period->locked_by)->toBe($this->home->hr->id)
        ->and($period->snapshot['rows'])->not->toBeEmpty();

    // Wages dated in the locked month are refused.
    $this->actingAs($this->home->hr)
        ->put(route('attendance.payroll.wages.update', ['employee' => $this->employee->id]), ['daily_wage' => 90_000, 'effective_from' => '2026-10-15'])
        ->assertSessionHasErrors(['effective_from' => 'Periode gaji Oktober 2026 sudah dikunci. Buka kunci di Absensi › Gaji dulu.']);

    // A month that has not started cannot be locked.
    $this->actingAs($this->home->hr)->post(route('attendance.payroll.lock', ['month' => '2026-12']))->assertSessionHasErrors('month');

    $this->actingAs($this->home->hr)->delete(route('attendance.payroll.unlock', ['month' => '2026-10']))->assertSessionHasNoErrors();

    expect($period->fresh()?->isLocked())->toBeFalse()
        ->and($period->fresh()?->snapshot)->toBeNull()
        ->and(AuditLog::query()->whereIn('action', ['payroll.rules_saved', 'payroll.period_locked', 'payroll.period_unlocked'])->pluck('action')->sort()->values()->all())
        ->toBe(['payroll.period_locked', 'payroll.period_unlocked', 'payroll.rules_saved']);
});

test('the Excel export lists the report and is audited', function () {
    Excel::fake();

    $this->actingAs($this->home->direksi)->get(route('attendance.payroll.export', ['bulan' => '2026-10']))->assertOk();

    Excel::assertDownloaded('gaji-harian-2026-10.xlsx', function (DailyPayrollExport $export): bool {
        $rows = $export->array();
        $rina = collect($rows)->firstWhere(1, 'Rina Gudang');

        return $export->headings()[0] === 'No. karyawan'
            && $export->headings()[13] === 'Total'
            && $rina !== null && $rina[4] === 100_000 && $rina[13] === 100_000;
    });

    expect(AuditLog::query()->where('action', 'payroll.exported')->sole()->new_values['month'])->toBe('2026-10');
});

test('access: Direksi reads only; Kepala Divisi and staff are refused', function () {
    $this->actingAs($this->home->superAdmin)->get(route('attendance.payroll.index'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('can.manage', true));
    $this->actingAs($this->home->direksi)->get(route('attendance.payroll.index'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('can.manage', false));
    $this->actingAs($this->home->direksi)->getJson(route('attendance.payroll.wages.index', ['employee' => $this->employee->id]))
        ->assertOk()->assertJsonPath('can.manage', false);

    $this->actingAs($this->home->direksi)->put(route('attendance.payroll.rules.update'), ['pay_leave' => true, 'pay_sick' => true, 'pay_permit' => true, 'late_deduction' => 0])->assertForbidden();
    $this->actingAs($this->home->direksi)->put(route('attendance.payroll.wages.update', ['employee' => $this->employee->id]), ['daily_wage' => 1, 'effective_from' => '2026-11-01'])->assertForbidden();
    $this->actingAs($this->home->direksi)->post(route('attendance.payroll.lock', ['month' => '2026-10']))->assertForbidden();
    $this->actingAs($this->home->direksi)->delete(route('attendance.payroll.unlock', ['month' => '2026-10']))->assertForbidden();
    $this->actingAs($this->home->direksi)->delete(route('attendance.payroll.wages.destroy', ['wage' => EmployeeWage::query()->value('id')]))->assertForbidden();

    foreach ([$this->home->kadiv, $this->home->anggota] as $denied) {
        $this->actingAs($denied)->get(route('attendance.payroll.index'))->assertForbidden();
        $this->actingAs($denied)->get(route('attendance.payroll.export'))->assertForbidden();
        $this->actingAs($denied)->getJson(route('attendance.payroll.wages.index', ['employee' => $this->employee->id]))->assertForbidden();
    }

    expect(EmployeeWage::query()->count())->toBe(1)->and(PayrollPeriod::query()->count())->toBe(0);
});

test('another company\'s employee and wage are 404 and never listed', function () {
    $foreign = foreignWorld();
    $wage = EmployeeWage::query()->where('user_id', $foreign->anggota->id)->sole();

    $this->actingAs($this->home->hr)->getJson(route('attendance.payroll.wages.index', ['employee' => $foreign->anggota->id]))->assertNotFound();
    $this->actingAs($this->home->hr)->put(route('attendance.payroll.wages.update', ['employee' => $foreign->anggota->id]), ['daily_wage' => 1, 'effective_from' => '2026-11-01'])->assertNotFound();
    $this->actingAs($this->home->hr)->delete(route('attendance.payroll.wages.destroy', ['wage' => $wage->id]))->assertNotFound();

    $page = $this->actingAs($this->home->hr)->get(route('attendance.payroll.index', ['bulan' => '2026-10']))->assertOk();

    expect(leaksForeign($page->getContent()))->toBeFalse()
        ->and($wage->fresh())->not->toBeNull()
        ->and(User::query()->find($foreign->anggota->id))->not->toBeNull();
});
