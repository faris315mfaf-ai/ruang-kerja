<?php

namespace App\Domain\Attendance\Exports;

use App\Domain\Attendance\Data\EmployeeRecap;
use App\Domain\Attendance\Data\RecapDay;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Data\RecapReport;
use App\Domain\Attendance\Enums\PayrollColumn;
use App\Domain\Attendance\Support\OfficeClock;
use App\Models\Company;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Symfony\Component\HttpFoundation\Response;

/**
 * PDF downloads of the monthly recap (barryvdh/laravel-dompdf, pure PHP).
 */
final class RecapPdf
{
    public function company(RecapReport $report, User $actor): Response
    {
        $columns = PayrollColumn::configured();
        $export = new PayrollRecapExport($report);

        return Pdf::loadView('exports.attendance-recap', [
            'title' => 'Rekap absensi · '.$report->period->label(),
            'companyName' => Company::query()->whereKey($actor->company_id)->value('name'),
            'periodLine' => self::periodLine($report->period),
            'generatedAt' => OfficeClock::date(CarbonImmutable::now()).' '.OfficeClock::time(CarbonImmutable::now()),
            'generatedBy' => $actor->name,
            'employees' => count($report->rows),
            'calendarWorkDays' => $report->calendarWorkDays,
            'attendanceRate' => $report->attendanceRate(),
            'lateCount' => $report->totalLateCount(),
            'overtimeHours' => $report->totalOvertimeHours(),
            'headings' => $export->headings(),
            'numeric' => array_map(fn (array $column): bool => ! $column[0]->isText(), $columns),
            'rows' => $export->array(),
        ])
            ->setPaper(config()->string('payroll_export.pdf.paper'), config()->string('payroll_export.pdf.orientation'))
            ->download(PayrollRecapExport::filename($report, 'pdf'));
    }

    public function personal(EmployeeRecap $recap, RecapPeriod $period): Response
    {
        return Pdf::loadView('exports.attendance-personal', [
            'title' => 'Rekap absensi · '.$period->label(),
            'employee' => $recap->user->name,
            'subtitle' => self::periodLine($period).($recap->shiftName === null ? '' : ' · Shift '.$recap->shiftName),
            'generatedAt' => OfficeClock::date(CarbonImmutable::now()).' '.OfficeClock::time(CarbonImmutable::now()),
            'stats' => [
                'Hari kerja' => $recap->workDays,
                'Hadir' => $recap->presentDays,
                'Terlambat' => $recap->lateCount.' · '.$recap->lateMinutes.' m',
                'Alpha' => $recap->absentDays,
                'Cuti' => $recap->leaveDays,
                'Izin' => $recap->permitDays,
                'Sakit' => $recap->sickDays,
                'Lembur' => number_format($recap->overtimeHours(), 1, ',', '.').' jam',
            ],
            'days' => array_map(fn (RecapDay $cell): array => self::personalDay($cell), $recap->days),
        ])
            ->setPaper('a4', 'portrait')
            ->download('rekap-absensi-saya-'.$period->key().'.pdf');
    }

    /**
     * @return array<string, string|bool|null>
     */
    private static function personalDay(RecapDay $cell): array
    {
        $day = $cell->day;
        $status = match ($cell->kind) {
            'off' => 'Libur/akhir pekan',
            'holiday' => $cell->holidayName ?? 'Libur',
            'upcoming' => 'Terjadwal',
            'none' => 'Belum ada catatan',
            default => $day?->status->label() ?? '',
        };

        if ($day !== null && $day->late_minutes > 0) {
            $status .= " ({$day->late_minutes} m)";
        }

        return [
            'date' => OfficeClock::date(CarbonImmutable::parse($cell->date), dateOnly: true),
            'status' => $status,
            'muted' => in_array($cell->kind, ['off', 'holiday', 'upcoming'], true),
            'in' => $day?->check_in_at === null ? null : OfficeClock::time($day->check_in_at),
            'out' => $day?->check_out_at === null ? null : OfficeClock::time($day->check_out_at),
            'method' => $day?->checkInLog?->method->label(),
            'location' => $day?->checkInLog?->officeLocation?->name,
            'note' => $day?->overtime_minutes ? 'Lembur '.number_format($day->overtime_minutes / 60, 1, ',', '.').' jam' : null,
        ];
    }

    private static function periodLine(RecapPeriod $period): string
    {
        $end = $period->countedUntil ?? $period->monthEnd;

        return $period->monthStart->day.'–'.$end->day.' '.RecapPeriod::MONTHS[$period->monthStart->month - 1].' '.$period->monthStart->year
            .($period->isRunning() ? ' (berjalan)' : '');
    }
}
