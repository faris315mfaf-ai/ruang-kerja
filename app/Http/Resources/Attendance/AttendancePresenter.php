<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Data\AttendanceResult;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Services\SelfieStorage;
use Carbon\CarbonInterface;

/**
 * Attendance data → Inertia props / JSON (camelCase, ISO-8601 UTC instants).
 * Coordinates of the employee are never sent back; only distances.
 */
final class AttendancePresenter
{
    public function __construct(private readonly SelfieStorage $selfies) {}

    /**
     * @return array<string, mixed>
     */
    public function schedule(DaySchedule $schedule): array
    {
        $shift = $schedule->shift;

        return [
            'workDate' => $schedule->workDateString(),
            'isWorkday' => $schedule->isWorkday(),
            'isHoliday' => $schedule->isHoliday(),
            'holidayName' => $schedule->holiday?->name,
            'isOverride' => $schedule->isOverride,
            'shiftName' => $shift?->name,
            'hours' => $shift?->hoursLabel(),
            'start' => self::iso($schedule->scheduledStart),
            'end' => self::iso($schedule->scheduledEnd),
            'checkInOpensAt' => self::iso($schedule->isWorkday() ? $schedule->checkInOpensAt() : null),
            'lateThreshold' => self::iso($schedule->isWorkday() ? $schedule->lateThreshold() : null),
            'workMode' => $schedule->workMode->value,
            'workModeLabel' => $schedule->workMode->label(),
            'allowsRemote' => $schedule->allowsRemoteCheckIn(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function day(AttendanceDay $day, bool $withSelfies = false): array
    {
        $shift = $day->shift;

        return [
            'id' => $day->id,
            'workDate' => $day->work_date->toDateString(),
            'status' => $day->status->value,
            'statusLabel' => $day->status->label(),
            'shiftName' => $shift?->name,
            'hours' => $shift?->hoursLabel(),
            'scheduledStart' => self::iso($day->scheduled_start),
            'scheduledEnd' => self::iso($day->scheduled_end),
            'checkInAt' => self::iso($day->check_in_at),
            'checkOutAt' => self::iso($day->check_out_at),
            'lateMinutes' => $day->late_minutes,
            'earlyLeaveMinutes' => $day->early_leave_minutes,
            'workMinutes' => $day->work_minutes,
            'isSuspicious' => $day->is_suspicious,
            'requestPortion' => $day->request_portion?->value,
            'workPlan' => $day->work_plan,
            'workReport' => $day->work_report,
            'checkIn' => $day->checkInLog === null ? null : $this->log($day->checkInLog, $withSelfies),
            'checkOut' => $day->checkOutLog === null ? null : $this->log($day->checkOutLog, $withSelfies),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function log(AttendanceLog $log, bool $withSelfie = false): array
    {
        $location = $log->officeLocation;

        return [
            'id' => $log->id,
            'type' => $log->type->value,
            'method' => $log->method->value,
            'methodLabel' => $log->method->label(),
            'occurredAt' => self::iso($log->occurred_at),
            'locationName' => $location?->name,
            'distanceM' => $log->distance_m === null ? null : (int) round($log->distance_m),
            'inside' => $log->office_location_id !== null,
            'note' => $log->note,
            'isSuspicious' => $log->is_suspicious,
            'selfieUrl' => $withSelfie ? $this->selfies->temporaryUrl($log) : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function location(OfficeLocation $location): array
    {
        return [
            'id' => $location->id,
            'name' => $location->name,
            'address' => $location->address,
            'latitude' => $location->latitude,
            'longitude' => $location->longitude,
            'radiusM' => $location->radius_m,
        ];
    }

    /**
     * Response of a successful check-in/out (screens CheckinSukses).
     *
     * @return array<string, mixed>
     */
    public function result(AttendanceResult $result): array
    {
        $day = $result->day;
        $log = $result->log;
        $match = $result->location->match;
        $start = $day->scheduled_start;
        $secondsBeforeStart = $start === null ? 0 : $start->getTimestamp() - $log->occurred_at->getTimestamp();

        return [
            'type' => $log->type->value,
            'workDate' => $day->work_date->toDateString(),
            'occurredAt' => self::iso($log->occurred_at),
            'status' => $day->status->value,
            'statusLabel' => $day->status->label(),
            'lateMinutes' => $day->late_minutes,
            'earlyLeaveMinutes' => $day->early_leave_minutes,
            'workMinutes' => $day->work_minutes,
            'minutesBeforeStart' => $secondsBeforeStart > 0 ? intdiv($secondsBeforeStart, 60) : null,
            'method' => $log->method->value,
            'methodLabel' => $log->method->label(),
            'location' => $match === null ? null : [
                'name' => $match->location->name,
                // Null for a QR scan without GPS.
                'distanceM' => $log->distance_m === null ? null : (int) round($log->distance_m),
                'radiusM' => $match->location->radius_m,
                'inside' => $match->inside,
            ],
            'shift' => $result->schedule->shift === null || ! $result->schedule->isWorkday() ? null : [
                'name' => $result->schedule->shift->name,
                'hours' => $result->schedule->shift->hoursLabel(),
            ],
            'isSuspicious' => $log->is_suspicious,
            'selfieUrl' => $this->selfies->temporaryUrl($log),
        ];
    }

    public static function iso(?CarbonInterface $value): ?string
    {
        return $value?->toIso8601ZuluString();
    }
}
