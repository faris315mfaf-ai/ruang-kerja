<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\AttendanceResult;
use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Services\AttendanceLogWriter;
use App\Domain\Attendance\Services\FraudDetector;
use App\Domain\Attendance\Services\LocationVerifier;
use App\Domain\Attendance\Services\OpenDayLocator;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * GPS + selfie check-out of the open day (today, or yesterday's overnight /
 * overtime day while it is still within the check-out grace period).
 */
final class CheckOut
{
    /**
     * A break is only deducted once the employee worked longer than this
     * (UU 13/2003 Pasal 79: rest after 4 consecutive working hours).
     */
    private const int BREAK_AFTER_MINUTES = 240;

    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly LocationVerifier $locations,
        private readonly FraudDetector $fraud,
        private readonly SelfieStorage $selfies,
        private readonly AttendanceLogWriter $logs,
        private readonly OpenDayLocator $openDays,
    ) {}

    public function handle(User $user, CheckInData $data): AttendanceResult
    {
        if (! AttendanceConsent::hasCurrentConsent($user)) {
            throw AttendanceException::consentRequired();
        }

        $now = CarbonImmutable::now();
        $days = $this->openDays->find($user, $now);

        if ($days->open === null) {
            throw $days->checkedOut?->check_out_at !== null
                ? AttendanceException::alreadyCheckedOut($days->checkedOut->check_out_at)
                : AttendanceException::notCheckedIn();
        }

        $openDay = $days->open;
        $schedule = $this->schedules->forDate($user, ScheduleResolver::parseDate($openDay->work_date->toDateString()));

        if ($openDay->status === AttendanceStatus::BusinessTrip) {
            $schedule = $schedule->asBusinessTrip();
        }

        $location = $this->locations->verify($user, $schedule, $data);
        $flags = $this->fraud->detect($user, $data, $now);
        $selfiePath = $this->selfies->store($user, $data->selfie, $now);

        try {
            [$day, $log] = DB::transaction(function () use ($user, $data, $openDay, $location, $flags, $selfiePath, $now): array {
                $day = AttendanceDay::query()->whereKey($openDay->id)->lockForUpdate()->firstOrFail();

                if ($day->check_out_at !== null) {
                    throw AttendanceException::alreadyCheckedOut($day->check_out_at);
                }

                $log = $this->logs->write($user, $day, AttendanceLogType::CheckOut, $data, $location, $flags, $selfiePath, $now);
                // Half-day leave/permit or business trip: the request explains the hours.
                $earlyMinutes = $day->isFromRequest() ? 0 : self::earlyLeaveMinutes($day, $now);

                $day->fill([
                    'check_out_at' => $now->utc(),
                    'check_out_log_id' => $log->id,
                    'early_leave_minutes' => $earlyMinutes,
                    'work_minutes' => self::workMinutes($day, $now),
                    'is_suspicious' => $day->is_suspicious || $log->is_suspicious,
                ]);

                if ($earlyMinutes > 0 && in_array($day->status, [AttendanceStatus::Present, AttendanceStatus::Wfh], true)) {
                    $day->status = AttendanceStatus::EarlyLeave;
                }

                $day->save();

                return [$day, $log];
            });
        } catch (Throwable $exception) {
            $this->selfies->delete($selfiePath);

            throw $exception;
        }

        AttendanceRecorded::dispatch($day, $log);

        return new AttendanceResult($day, $log, $schedule, $location);
    }

    /**
     * Whole minutes before the early-leave limit (scheduled end − tolerance).
     */
    public static function earlyLeaveMinutes(AttendanceDay $day, CarbonImmutable $now): int
    {
        if ($day->scheduled_end === null || $day->shift_id === null) {
            return 0;
        }

        $tolerance = Shift::withTrashed()->whereKey($day->shift_id)->value('early_leave_tolerance_min');
        $threshold = $day->scheduled_end->subMinutes(is_numeric($tolerance) ? (int) $tolerance : 0);
        $seconds = $threshold->getTimestamp() - $now->getTimestamp();

        return $seconds <= 0 ? 0 : intdiv($seconds, 60);
    }

    public static function workMinutes(AttendanceDay $day, CarbonImmutable $now): int
    {
        if ($day->check_in_at === null) {
            return 0;
        }

        $span = intdiv(max(0, $now->getTimestamp() - $day->check_in_at->getTimestamp()), 60);
        $break = 0;

        if ($day->shift_id !== null && $span > self::BREAK_AFTER_MINUTES) {
            $value = Shift::withTrashed()->whereKey($day->shift_id)->value('break_minutes');
            $break = is_numeric($value) ? (int) $value : 0;
        }

        return max(0, $span - $break);
    }
}
