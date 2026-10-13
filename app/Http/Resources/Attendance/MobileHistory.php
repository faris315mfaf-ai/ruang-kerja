<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Data\EmployeeRecap;
use App\Domain\Attendance\Data\RecapDay;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\CorrectionWindow;
use App\Domain\Attendance\Support\OfficeClock;
use App\Models\EmployeeRequest;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Own attendance history for the Android app: the calendar cells of the web
 * recap (RecapPresenter::cell, unchanged keys) enriched with what the day
 * detail needs — the work plan, flags the owner may see, the request behind
 * the day and the correction entry — plus the day detail itself. The selfie is
 * never part of any of it (only HR and the direct manager may see it, each
 * access audited; docs/PRD.md §8 Privasi).
 */
final class MobileHistory
{
    public function __construct(private readonly RecapPresenter $recap) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function cells(EmployeeRecap $recap, RecapPeriod $period, CorrectionWindow $window): array
    {
        $first = $period->monthStart->toDateString();
        $last = $period->monthEnd->toDateString();
        $open = $window->available() ? CorrectionWindow::requestsByDate($recap->user, $first, $last) : [];
        $today = OfficeClock::local(CarbonImmutable::now())->toDateString();

        return array_map(
            fn (RecapDay $cell): array => $this->cell($cell, $window, $open[$cell->date] ?? null, $today),
            $recap->days,
        );
    }

    /**
     * @param  array{id: string, number: string|null, status: string, statusLabel: string}|null  $pending  open or approved correction request of that date
     * @return array<string, mixed>
     */
    public function cell(RecapDay $cell, CorrectionWindow $window, ?array $pending, string $today): array
    {
        $day = $cell->day;
        $base = $this->recap->cell($cell);
        $checkIn = $day?->checkInLog;
        $checkOut = $day?->checkOutLog;
        $blocked = $pending !== null && in_array($pending['status'], ['pending', 'revision_requested'], true);

        return [
            ...$base,
            'status' => $day?->status->value,
            'scheduledStart' => AttendancePresenter::iso($day?->scheduled_start),
            'scheduledEnd' => AttendancePresenter::iso($day?->scheduled_end),
            'checkInAt' => AttendancePresenter::iso($day?->check_in_at),
            'checkOutAt' => AttendancePresenter::iso($day?->check_out_at),
            'locationLabel' => $checkIn === null ? null : ($checkIn->officeLocation->name ?? $checkIn->method->label()),
            'workPlan' => ($day->work_plan ?? []),
            'workReport' => ($day->work_report ?? []),
            'note' => $day?->note,
            'flags' => $this->flags(array_filter([$checkIn, $checkOut])),
            'isCorrected' => ($checkIn?->corrected_by !== null) || ($checkOut?->corrected_by !== null),
            'request' => $this->request($day?->employeeRequest, $day?->request_portion?->value),
            'correction' => [
                'canCorrect' => ! $blocked
                    && ($cell->isWorkday || $day !== null)
                    && $window->allows($cell->date, $today),
                'deadline' => $window->deadline($cell->date),
                'pendingRequest' => $pending,
            ],
        ];
    }

    /**
     * Detail of one day: the enriched cell and every log of the day (no selfie).
     *
     * @param  array{id: string, number: string|null, status: string, statusLabel: string}|null  $pending
     * @return array<string, mixed>
     */
    public function detail(RecapDay $cell, CorrectionWindow $window, ?array $pending, string $today): array
    {
        $logs = $cell->day === null
            ? collect()
            : $cell->day->logs()->with('officeLocation')->orderBy('occurred_at')->get();

        $day = $this->cell($cell, $window, $pending, $today);
        // The owner never gets a selfie (not even a null URL key): HR and the direct manager only.
        unset($day['checkIn']['selfieUrl'], $day['checkOut']['selfieUrl']);

        return [
            'date' => $cell->date,
            'dateLabel' => OfficeClock::date(CarbonImmutable::parse($cell->date), dateOnly: true),
            'day' => $day,
            'logs' => $logs->map(fn (AttendanceLog $log): array => $this->log($log))->values()->all(),
            'correction' => $this->correction($window),
            'privacyNote' => 'Selfie hanya dapat dilihat oleh HR dan atasan langsung Anda, dan setiap akses tercatat.',
        ];
    }

    /**
     * What the app needs to open the correction form (the form itself and the
     * POST /pengajuan belong to the requests module).
     *
     * @return array{available: bool, typeId: string|null, typeCode: string|null, typeName: string|null, maxBackdateDays: int|null}
     */
    public function correction(CorrectionWindow $window): array
    {
        $type = $window->type();

        return [
            'available' => $window->available(),
            'typeId' => $type?->id,
            'typeCode' => $type?->code,
            'typeName' => $type?->name,
            'maxBackdateDays' => $window->maxBackdateDays(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function log(AttendanceLog $log): array
    {
        return [
            'id' => $log->id,
            'type' => $log->type->value,
            'typeLabel' => $log->type->label(),
            'method' => $log->method->value,
            'methodLabel' => $log->method->label(),
            'occurredAt' => AttendancePresenter::iso($log->occurred_at),
            'receivedAt' => AttendancePresenter::iso($log->received_at),
            'locationName' => $log->officeLocation?->name,
            'inside' => $log->office_location_id !== null,
            'distanceM' => $log->distance_m === null ? null : (int) round($log->distance_m),
            'accuracyM' => $log->accuracy_m === null ? null : (int) round($log->accuracy_m),
            'note' => $log->note,
            'flags' => $this->flags([$log]),
            'isCorrection' => $log->corrected_by !== null,
            'reviewedAt' => AttendancePresenter::iso($log->reviewed_at),
        ];
    }

    /**
     * Flags the owner sees, neutral wording; a new IP is informational only.
     *
     * @param  iterable<AttendanceLog>  $logs
     * @return list<array{code: string, label: string}>
     */
    private function flags(iterable $logs): array
    {
        /** @var Collection<string, array{code: string, label: string}> $flags */
        $flags = collect();

        foreach ($logs as $log) {
            foreach ($log->flags as $flag) {
                if ($flag === LogFlag::NewIp) {
                    continue;
                }

                $flags->put($flag->value, ['code' => $flag->value, 'label' => $flag->label()]);
            }
        }

        return array_values($flags->all());
    }

    /**
     * @return array<string, mixed>|null
     */
    private function request(?EmployeeRequest $request, ?string $portion): ?array
    {
        if ($request === null) {
            return null;
        }

        return [
            'id' => $request->id,
            'number' => $request->number,
            'type' => $request->leaveType->name,
            'category' => $request->leaveType->category->value,
            'categoryLabel' => $request->leaveType->category->label(),
            'status' => $request->status->value,
            'statusLabel' => $request->status->label(),
            'portion' => $portion,
        ];
    }
}
