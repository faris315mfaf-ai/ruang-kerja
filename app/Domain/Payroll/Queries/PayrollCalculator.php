<?php

namespace App\Domain\Payroll\Queries;

use App\Domain\Attendance\Data\EmployeeRecap;
use App\Domain\Attendance\Data\RecapDay;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Payroll\Data\DayPay;
use App\Domain\Payroll\Data\PayrollReport;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Domain\Payroll\Models\PayrollRule;
use App\Models\Division;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Gaji harian (keputusan pemilik 20 Okt 2026, docs/fitur/absensi-gaji.md):
 * per employee, daily wage × paid days of the month.
 *
 * - Employees and days come from MonthlyRecap::report (visibleTo the viewer,
 *   same population as Absensi › Rekap).
 * - Wage of a date: the employee's wage with the latest effective_from on or
 *   before it; none → that day pays 0 and the row is flagged `missing_wage`.
 * - Paid: Hadir, Terlambat, Pulang cepat, WFH, Dinas (1 day; a half-day
 *   leave/permit splits 0.5/0.5); Cuti / Sakit / Izin when the company rule
 *   pays them (else unpaid). Alpha is unpaid. Libur / no schedule don't count.
 *   Perlu koreksi, a scheduled day without any record, and today before
 *   check-in are `pending`: not paid, counted separately.
 * - Deduction: late days × rules.late_deduction; total never below 0.
 * - A locked month returns its snapshot (payroll_periods.snapshot).
 */
final class PayrollCalculator
{
    public function __construct(private readonly MonthlyRecap $recaps) {}

    /**
     * @param  array{division_id?: string|null, search?: string|null}  $filters
     * @param  bool  $live  ignore a lock snapshot (used to take the snapshot)
     */
    public function forMonth(User $viewer, RecapPeriod $period, array $filters = [], bool $live = false): PayrollReport
    {
        $record = PayrollPeriod::query()
            ->with('locker:id,name')
            ->where('company_id', $viewer->company_id)
            ->whereDate('month', $period->monthStart->toDateString())
            ->first();

        $meta = [
            'month' => $period->key(),
            'label' => $period->label(),
            'locked' => $record?->isLocked() ?? false,
            'locked_at' => $record?->locked_at?->toIso8601ZuluString(),
            'locked_by_name' => $record?->isLocked() === true ? $record->locker?->name : null,
            ...$this->workdays($viewer->company_id, $period),
        ];

        if (! $live && $record !== null && $record->isLocked() && is_array($record->snapshot)) {
            return $this->fromSnapshot($record->snapshot, $meta, $filters);
        }

        $rules = PayrollRule::forCompany($viewer->company_id)->toRules();
        $recap = $this->recaps->report($viewer, $period, $filters);
        $wages = $this->wages(array_map(fn (EmployeeRecap $row): string => $row->user->id, $recap->rows), $period);
        $rows = array_map(fn (EmployeeRecap $row): array => $this->row($row, $period, $rules, $wages->get($row->user->id, [])), $recap->rows);

        return new PayrollReport($rows, PayrollReport::totalsOf($rows), $rules, [...$meta, 'computed_at' => CarbonImmutable::now()->toIso8601ZuluString()]);
    }

    /**
     * How one date counts (also used by the day sheet of Absensi › Pegawai).
     *
     * @param  array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int}  $rules
     */
    public static function classify(?AttendanceDay $record, string $kind, bool $counted, array $rules): DayPay
    {
        if (! $counted) {
            return new DayPay(label: 'Belum terjadi');
        }

        if ($record === null) {
            return $kind === 'none'
                ? new DayPay(pending: 1, label: 'Belum dihitung · belum ada catatan')
                : new DayPay(label: 'Tidak dihitung · tidak terjadwal');
        }

        if ($record->request_portion === RequestPortion::HalfDay) {
            return self::halfDay($record, $rules);
        }

        $status = $record->status;
        $late = $record->late_minutes > 0 || $status === AttendanceStatus::Late;

        if ($status->isAttended() || $status === AttendanceStatus::BusinessTrip) {
            return new DayPay(presentPaid: 1, late: $late, label: 'Dibayar · '.$status->label());
        }

        return match ($status) {
            AttendanceStatus::Leave, AttendanceStatus::Sick, AttendanceStatus::Permit => self::absence($status, 1, $rules),
            AttendanceStatus::Absent => new DayPay(absent: 1, label: 'Tidak dibayar · Alpha'),
            AttendanceStatus::NeedsCorrection => new DayPay(pending: 1, late: $late, label: 'Belum dihitung · Perlu koreksi'),
            default => new DayPay(label: 'Tidak dihitung · '.$status->label()),
        };
    }

    /**
     * Half-day leave/permit: the absence half follows the rules; the other
     * half is paid when the employee checked in, otherwise unpaid (pending
     * while it is still today).
     *
     * @param  array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int}  $rules
     */
    private static function halfDay(AttendanceDay $record, array $rules): DayPay
    {
        $absence = $record->status->comesFromRequest()
            ? $record->status
            : AttendanceStatus::tryFrom((string) $record->employeeRequest?->leaveType->category->attendanceStatus());
        $half = $absence === AttendanceStatus::BusinessTrip || $absence === null
            ? new DayPay(presentPaid: 0.5)
            : self::absence($absence, 0.5, $rules);
        $today = $record->work_date->toDateString() === ScheduleResolver::officeDate(CarbonImmutable::now())->toDateString();
        $worked = $record->check_in_at !== null;

        return new DayPay(
            presentPaid: $half->presentPaid + ($worked ? 0.5 : 0),
            leavePaid: $half->leavePaid,
            leaveUnpaid: $half->leaveUnpaid,
            absent: ! $worked && ! $today ? 0.5 : 0,
            pending: ! $worked && $today ? 0.5 : 0,
            label: ($half->leavePaid + $half->presentPaid > 0 ? 'Dibayar' : 'Sebagian dibayar').' · setengah hari '.($absence?->label() ?? ''),
        );
    }

    /**
     * @param  array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int}  $rules
     */
    private static function absence(AttendanceStatus $status, float $days, array $rules): DayPay
    {
        $paid = match ($status) {
            AttendanceStatus::Leave => $rules['pay_leave'],
            AttendanceStatus::Sick => $rules['pay_sick'],
            AttendanceStatus::Permit => $rules['pay_permit'],
            default => false,
        };

        return $paid
            ? new DayPay(leavePaid: $days, label: 'Dibayar · '.$status->label())
            : new DayPay(leaveUnpaid: $days, label: 'Tidak dibayar · '.$status->label());
    }

    /**
     * Wage of an office date from the employee's rows (sorted by effective_from).
     *
     * @param  list<array{0: string, 1: int}>  $wages  [effective_from Y-m-d, daily_wage]
     */
    public static function wageOn(array $wages, string $date): ?int
    {
        $wage = null;

        foreach ($wages as [$from, $amount]) {
            if ($from > $date) {
                break;
            }

            $wage = $amount;
        }

        return $wage;
    }

    /**
     * @param  array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int}  $rules
     * @param  list<array{0: string, 1: int}>  $wages
     * @return array<string, mixed>
     */
    private function row(EmployeeRecap $recap, RecapPeriod $period, array $rules, array $wages): array
    {
        $user = $recap->user;
        $present = $leavePaid = $leaveUnpaid = $absent = $pending = 0.0;
        $late = 0;
        $earned = 0.0;
        $missing = false;
        $applied = [];

        foreach ($recap->days as $cell) {
            /** @var RecapDay $cell */
            $counted = $period->countedUntil !== null && $cell->date <= $period->countedUntil->toDateString();
            $pay = self::classify($cell->day, $cell->kind, $counted, $rules);
            $wage = self::wageOn($wages, $cell->date);

            if ($wage !== null) {
                $applied[$wage] = true;
            }

            if (! $pay->counts()) {
                continue;
            }

            $present += $pay->presentPaid;
            $leavePaid += $pay->leavePaid;
            $leaveUnpaid += $pay->leaveUnpaid;
            $absent += $pay->absent;
            $pending += $pay->pending;
            $late += $pay->late ? 1 : 0;

            if ($pay->paid() > 0) {
                $missing = $missing || $wage === null;
                $earned += $pay->paid() * ($wage ?? 0);
            }
        }

        $reference = ($period->countedUntil ?? $period->monthStart)->toDateString();
        $current = self::wageOn($wages, $reference);
        $deduction = $late * $rules['late_deduction'];
        $gross = (int) round($earned);

        return [
            'user_id' => $user->id,
            'name' => $user->name,
            'division_id' => $user->division_id,
            'division' => $user->division?->name,
            'position' => $user->position?->name,
            'employee_number' => $user->profile?->employee_number,
            'daily_wage' => $current,
            'wage_changed_in_period' => count($applied) > 1,
            'missing_wage' => $missing || $current === null,
            'present_days' => PayrollReport::number($present),
            'paid_leave_days' => PayrollReport::number($leavePaid),
            'unpaid_days' => PayrollReport::number($leaveUnpaid),
            'absent_days' => PayrollReport::number($absent),
            'late_count' => $late,
            'pending_days' => PayrollReport::number($pending),
            'paid_days' => PayrollReport::number($present + $leavePaid),
            'gross' => $gross,
            'deduction' => $deduction,
            'total' => max(0, $gross - $deduction),
        ];
    }

    /**
     * @param  list<string>  $userIds
     * @return Collection<string, list<array{0: string, 1: int}>>
     */
    private function wages(array $userIds, RecapPeriod $period): Collection
    {
        if ($userIds === []) {
            return collect();
        }

        return EmployeeWage::query()
            ->whereIn('user_id', $userIds)
            ->whereDate('effective_from', '<=', $period->monthEnd->toDateString())
            ->orderBy('effective_from')
            ->get(['user_id', 'effective_from', 'daily_wage'])
            ->groupBy('user_id')
            ->map(fn (Collection $rows): array => array_values($rows->map(
                fn (EmployeeWage $wage): array => [$wage->effective_from->toDateString(), $wage->daily_wage],
            )->all()));
    }

    /**
     * Company calendar (Monday–Friday without holidays): elapsed and total
     * work days of the month.
     *
     * @return array{workdays_elapsed: int, workdays_total: int}
     */
    private function workdays(string $companyId, RecapPeriod $period): array
    {
        $holidays = Holiday::query()
            ->where('company_id', $companyId)
            ->whereBetween('date', [$period->monthStart->toDateString(), $period->monthEnd->toDateString()])
            ->pluck('date')
            ->map(fn ($date): string => CarbonImmutable::parse($date)->toDateString())
            ->all();
        $total = $elapsed = 0;

        for ($date = $period->monthStart; $date->lte($period->monthEnd); $date = $date->addDay()) {
            if ($date->dayOfWeekIso >= 6 || in_array($date->toDateString(), $holidays, true)) {
                continue;
            }

            $total++;

            if ($period->countedUntil !== null && $date->lte($period->countedUntil)) {
                $elapsed++;
            }
        }

        return ['workdays_elapsed' => $elapsed, 'workdays_total' => $total];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @param  array<string, mixed>  $meta
     * @param  array{division_id?: string|null, search?: string|null}  $filters
     */
    private function fromSnapshot(array $snapshot, array $meta, array $filters): PayrollReport
    {
        /** @var list<array<string, mixed>> $rows */
        $rows = is_array($snapshot['rows'] ?? null) ? $snapshot['rows'] : [];
        $division = $filters['division_id'] ?? null;
        $divisions = $division === null ? [] : Division::withDescendantIds([(string) $division]);
        $search = mb_strtolower(trim($filters['search'] ?? ''));

        $rows = array_values(array_filter($rows, fn (array $row): bool => ($division === null || in_array($row['division_id'] ?? null, $divisions, true))
            && ($search === '' || str_contains(mb_strtolower((string) ($row['name'] ?? '')), $search))));

        /** @var array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int} $rules */
        $rules = is_array($snapshot['rules'] ?? null) ? $snapshot['rules'] : (new PayrollRule)->toRules();

        return new PayrollReport($rows, PayrollReport::totalsOf($rows), $rules, [
            ...$meta,
            'computed_at' => $snapshot['period']['computed_at'] ?? null,
        ]);
    }
}
