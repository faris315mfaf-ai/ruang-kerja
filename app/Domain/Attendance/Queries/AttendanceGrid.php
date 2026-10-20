<?php

namespace App\Domain\Attendance\Queries;

use App\Domain\Attendance\Data\EmployeeRecap;
use App\Domain\Attendance\Data\RecapDay;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Support\OfficeClock;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Absensi › Pegawai (keputusan pemilik 20 Okt 2026): every employee × every
 * day of a month, built on MonthlyRecap::report (same people, same rules as
 * Absensi › Rekap; visibleTo the viewer).
 *
 * Cell `code`: a status value, `holiday`, `off` (no schedule / not
 * employed), `future` (scheduled, not yet), `not_checked_in` (scheduled
 * today, nothing yet), or `none` (a past scheduled day without any record).
 */
final class AttendanceGrid
{
    /** Cell codes that need HR's attention ("Hanya yang bermasalah"). */
    private const array PROBLEMS = ['absent', 'needs_correction', 'none', 'not_checked_in'];

    public function __construct(private readonly MonthlyRecap $recaps) {}

    /**
     * @param  array{division_id?: string|null, search?: string|null, problems_only?: bool}  $filters
     * @return array{rows: list<array<string, mixed>>, today: array<string, int>|null}
     */
    public function forMonth(User $viewer, RecapPeriod $period, array $filters = []): array
    {
        $report = $this->recaps->report($viewer, $period, [
            'division_id' => $filters['division_id'] ?? null,
            'search' => $filters['search'] ?? null,
        ]);
        $today = ScheduleResolver::officeDate(CarbonImmutable::now())->toDateString();
        $rows = array_map(fn (EmployeeRecap $recap): array => $this->row($recap, $today), $report->rows);
        $inMonth = $today >= $period->monthStart->toDateString() && $today <= $period->monthEnd->toDateString();
        $summary = $inMonth ? $this->today($rows, $today) : null;

        if ($filters['problems_only'] ?? false) {
            $rows = array_values(array_filter($rows, fn (array $row): bool => $row['problems'] > 0));
        }

        return ['rows' => $rows, 'today' => $summary];
    }

    /**
     * @return array<string, mixed>
     */
    private function row(EmployeeRecap $recap, string $today): array
    {
        $user = $recap->user;
        $cells = array_map(fn (RecapDay $cell): array => $this->cell($cell, $today), $recap->days);
        $problems = count(array_filter($cells, fn (array $cell): bool => in_array($cell['code'], self::PROBLEMS, true)));

        return [
            'id' => $user->id,
            'name' => $user->name,
            'initials' => self::initials($user->name),
            'division' => $user->division?->name,
            'position' => $user->position?->name,
            'cells' => $cells,
            'totals' => [
                'present' => EmployeeRecap::days($recap->presentDays),
                'late' => $recap->lateCount,
                'absent' => $recap->absentDays,
                'permit_sick_leave' => EmployeeRecap::days($recap->leaveDays + $recap->permitDays + $recap->sickDays),
            ],
            'problems' => $problems + $recap->lateCount,
        ];
    }

    /**
     * @return array{date: string, code: string, check_in: string|null, check_out: string|null, manual: bool, from_request: bool, has_logs: bool}
     */
    private function cell(RecapDay $cell, string $today): array
    {
        $day = $cell->day;
        $code = match (true) {
            $day !== null => $day->status->value,
            $cell->kind === 'upcoming' => 'future',
            $cell->kind === 'none' && $cell->date === $today => 'not_checked_in',
            default => $cell->kind,
        };

        return [
            'date' => $cell->date,
            'code' => $code,
            'check_in' => $day?->check_in_at === null ? null : OfficeClock::local($day->check_in_at)->format('H.i'),
            'check_out' => $day?->check_out_at === null ? null : OfficeClock::local($day->check_out_at)->format('H.i'),
            'manual' => $day?->isManual() ?? false,
            'from_request' => $day?->isFromRequest() ?? false,
            'has_logs' => $day !== null && ($day->check_in_log_id !== null || $day->check_out_log_id !== null),
        ];
    }

    /**
     * Today's tiles over the rows: present (checked in), not checked in yet,
     * late today, Alpha days of the month, and "perlu koreksi" days of the month.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, int>
     */
    private function today(array $rows, string $today): array
    {
        $summary = ['present' => 0, 'not_checked_in' => 0, 'late' => 0, 'absent_month' => 0, 'needs_correction' => 0];

        foreach ($rows as $row) {
            $summary['absent_month'] += (int) $row['totals']['absent'];

            foreach ($row['cells'] as $cell) {
                if ($cell['code'] === AttendanceStatus::NeedsCorrection->value) {
                    $summary['needs_correction']++;
                }

                if ($cell['date'] !== $today) {
                    continue;
                }

                if ($cell['check_in'] !== null) {
                    $summary['present']++;
                } elseif ($cell['code'] === 'not_checked_in') {
                    $summary['not_checked_in']++;
                }

                if ($cell['code'] === AttendanceStatus::Late->value) {
                    $summary['late']++;
                }
            }
        }

        return $summary;
    }

    private static function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $first = $parts[0] ?? '';
        $last = count($parts) > 1 ? (string) end($parts) : '';

        return Str::upper(mb_substr($first, 0, 1).mb_substr($last, 0, 1));
    }
}
