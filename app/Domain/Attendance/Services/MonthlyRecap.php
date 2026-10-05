<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\EmployeeRecap;
use App\Domain\Attendance\Data\RecapDay;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Data\RecapReport;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Support\OfficeClock;
use App\Models\Division;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Monthly attendance recap per employee (docs/PRD.md M2 "Rekap & ekspor").
 *
 * - Work days: dates whose schedule is a workday (ScheduleResolver rules).
 * - Present: days with a check-in (present, late, early leave, WFH, and
 *   "perlu koreksi" days that have a check-in). Late days are included.
 * - Late: count and minutes of days with late_minutes > 0.
 * - Alpha, cuti, izin, sakit, dinas: attendance_days.status as written by
 *   closing the day and by approved requests (Sprint 4). A half-day
 *   leave/permit (request_portion = half_day) counts 0.5 (tallyHalfDay).
 * - Overtime: attendance_days.overtime_minutes (approved overtime, Sprint 4).
 *
 * Only dates up to today count in the running month, and only dates of
 * employment: from joined_at up to the deactivation date (inactive/resigned).
 * Employees with nothing counted in the month are left out of the report.
 */
final class MonthlyRecap
{
    public function __construct(private readonly ScheduleResolver $schedules) {}

    /**
     * @param  array{division_id?: string|null, search?: string|null}  $filters
     */
    public function report(User $viewer, RecapPeriod $period, array $filters = []): RecapReport
    {
        $divisionId = $filters['division_id'] ?? null;
        $search = trim($filters['search'] ?? '');

        $users = User::query()
            ->whereIn('users.id', AttendanceDay::visibleUserIds($viewer))
            ->with(['division:id,name', 'position:id,name', 'profile:user_id,employee_number'])
            ->when($divisionId !== null, fn (Builder $query) => $query->whereIn('division_id', Division::withDescendantIds([(string) $divisionId])))
            ->when($search !== '', fn (Builder $query) => $query->where('name', 'ilike', '%'.addcslashes($search, '%_\\').'%'))
            ->orderBy('name')
            ->get();

        $rows = array_values(array_filter(
            $this->build($users, $period),
            // Employees without any schedule or record in the month (e.g. Direksi) are left out.
            fn (EmployeeRecap $row): bool => $row->workDays > 0 || $row->presentDays > 0 || $row->leaveDays + $row->permitDays + $row->sickDays + $row->businessTripDays > 0,
        ));

        [$workDays, $weekend, $holidays] = $this->calendar($viewer->company_id, $period);

        return new RecapReport($period, $rows, $workDays, $weekend, $holidays);
    }

    public function employee(User $user, RecapPeriod $period): EmployeeRecap
    {
        $user->loadMissing(['division:id,name', 'position:id,name', 'profile:user_id,employee_number']);

        return $this->build(collect([$user]), $period)[0];
    }

    /**
     * @param  Collection<int, User>  $users
     * @return list<EmployeeRecap>
     */
    private function build(Collection $users, RecapPeriod $period): array
    {
        if ($users->isEmpty()) {
            return [];
        }

        $schedules = $this->schedules->forRange($users, $period->monthStart, $period->monthEnd);

        /** @var Collection<string, Collection<string, AttendanceDay>> $records */
        $records = AttendanceDay::query()
            ->with(['shift', 'checkInLog.officeLocation', 'checkOutLog.officeLocation', 'employeeRequest.leaveType'])
            ->whereIn('user_id', $users->pluck('id'))
            ->whereBetween('work_date', [$period->monthStart->toDateString(), $period->monthEnd->toDateString()])
            ->get()
            ->groupBy('user_id')
            ->map(fn (Collection $days): Collection => $days->keyBy(fn (AttendanceDay $day): string => $day->work_date->toDateString()));

        $rows = [];

        foreach ($users as $user) {
            $recap = new EmployeeRecap($user);
            $own = $records->get($user->id, collect());
            $checkIns = [];
            $shifts = [];
            [$employedFrom, $employedUntil] = self::employment($user);

            for ($date = $period->monthStart; $date->lte($period->monthEnd); $date = $date->addDay()) {
                $key = $date->toDateString();

                if (($employedFrom !== null && $key < $employedFrom) || ($employedUntil !== null && $key > $employedUntil)) {
                    // Not employed on this date: shown as unscheduled, never counted.
                    $recap->days[] = new RecapDay($key, 'off', false);

                    continue;
                }

                $schedule = $schedules[$user->id][$key] ?? null;
                $record = $own->get($key);
                $counted = $period->countedUntil !== null && $date->lte($period->countedUntil);
                $isWorkday = $schedule?->isWorkday() ?? false;

                $kind = match (true) {
                    $record !== null => $record->status->value,
                    $schedule?->isHoliday() ?? false => 'holiday',
                    ! $isWorkday => 'off',
                    ! $counted => 'upcoming',
                    default => 'none',
                };

                $recap->days[] = new RecapDay($key, $kind, $isWorkday, $record, $schedule?->holiday?->name);

                if (! $counted) {
                    continue;
                }

                $isWorkday ? $recap->workDays++ : $recap->offDays++;

                if ($isWorkday && $schedule->shift !== null) {
                    $label = $schedule->shift->name.' '.$schedule->shift->hoursLabel();
                    $shifts[$label] = ($shifts[$label] ?? 0) + 1;
                }

                if ($record !== null) {
                    $minute = $this->tally($recap, $record);

                    if ($minute !== null) {
                        $checkIns[] = $minute;
                    }
                }
            }

            arsort($shifts);
            $recap->shiftName = array_key_first($shifts);
            $recap->averageCheckInMinute = $checkIns === [] ? null : (int) round(array_sum($checkIns) / count($checkIns));
            $rows[] = $recap;
        }

        return $rows;
    }

    /**
     * A day covered by a half-day leave/permit: 0.5 leave/permit days, plus
     * 0.5 present days when the employee checked in for the other half. The
     * same numbers whether the request was approved before the check-in (row
     * status = leave/permit) or after it (row keeps present/late, linked via
     * request_id). Lateness and early leave never count on such a day, as a
     * check-in on a request day is never late (CheckIn).
     */
    private function tallyHalfDay(EmployeeRecap $recap, AttendanceDay $day): void
    {
        $absence = $day->status->comesFromRequest()
            ? $day->status
            : AttendanceStatus::tryFrom((string) $day->employeeRequest?->leaveType->category->attendanceStatus());

        match ($absence) {
            AttendanceStatus::Leave => $recap->leaveDays += 0.5,
            AttendanceStatus::Permit => $recap->permitDays += 0.5,
            default => null,
        };

        if ($day->check_in_at !== null) {
            $recap->presentDays += 0.5;
        }
    }

    /**
     * First and last office date of employment ("Y-m-d", null = open):
     * joined_at, and for inactive/resigned employees the office date of
     * deactivated_at (rows from before that column fall back to updated_at).
     *
     * @return array{0: string|null, 1: string|null}
     */
    private static function employment(User $user): array
    {
        $until = null;

        if (! $user->isActive()) {
            $end = $user->deactivated_at ?? $user->updated_at;
            $until = $end !== null ? ScheduleResolver::officeDate($end)->toDateString() : null;
        }

        return [$user->joined_at?->toDateString(), $until];
    }

    /**
     * Adds one recorded day; returns its check-in minute of day (office time).
     */
    private function tally(EmployeeRecap $recap, AttendanceDay $day): ?int
    {
        $status = $day->status;

        if ($day->request_portion === RequestPortion::HalfDay) {
            $this->tallyHalfDay($recap, $day);
        } else {
            if ($status->isAttended() || ($status === AttendanceStatus::NeedsCorrection && $day->check_in_at !== null)) {
                $recap->presentDays++;
            }

            if ($day->late_minutes > 0) {
                $recap->lateCount++;
                $recap->lateMinutes += $day->late_minutes;
            }

            if ($day->early_leave_minutes > 0) {
                $recap->earlyLeaveCount++;
            }

            match ($status) {
                AttendanceStatus::Absent => $recap->absentDays++,
                AttendanceStatus::Leave => $recap->leaveDays++,
                AttendanceStatus::Permit => $recap->permitDays++,
                AttendanceStatus::Sick => $recap->sickDays++,
                AttendanceStatus::BusinessTrip => $recap->businessTripDays++,
                AttendanceStatus::Wfh => $recap->wfhDays++,
                AttendanceStatus::NeedsCorrection => $recap->needsCorrectionDays++,
                default => null,
            };
        }

        $recap->overtimeMinutes += $day->overtime_minutes;
        $recap->workMinutes += $day->work_minutes;

        if ($day->is_suspicious) {
            $recap->suspiciousDays++;
        }

        if ($day->check_in_at === null) {
            return null;
        }

        $local = OfficeClock::local($day->check_in_at);

        return $local->hour * 60 + $local->minute;
    }

    /**
     * Company calendar of the whole month: Monday–Friday work days, weekend
     * days, and holidays on weekdays.
     *
     * @return array{0: int, 1: int, 2: int}
     */
    private function calendar(string $companyId, RecapPeriod $period): array
    {
        $holidays = Holiday::query()
            ->where('company_id', $companyId)
            ->whereBetween('date', [$period->monthStart->toDateString(), $period->monthEnd->toDateString()])
            ->get()
            ->map(fn (Holiday $holiday): string => $holiday->date->toDateString())
            ->all();

        $work = $weekend = $holiday = 0;

        for ($date = $period->monthStart; $date->lte($period->monthEnd); $date = $date->addDay()) {
            match (true) {
                $date->dayOfWeekIso >= 6 => $weekend++,
                in_array($date->toDateString(), $holidays, true) => $holiday++,
                default => $work++,
            };
        }

        return [$work, $weekend, $holiday];
    }
}
