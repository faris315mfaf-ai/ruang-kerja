<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\AttendanceResult;
use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Data\LocationVerdict;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\AttendanceLogWriter;
use App\Domain\Attendance\Services\FraudDetector;
use App\Domain\Attendance\Services\LocationVerifier;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * GPS + selfie check-in (docs/ARCHITECTURE.md §3.1): consent → schedule →
 * geofence → fraud flags → private selfie → log + day in one transaction →
 * broadcast.
 */
final class CheckIn
{
    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly LocationVerifier $locations,
        private readonly FraudDetector $fraud,
        private readonly SelfieStorage $selfies,
        private readonly AttendanceLogWriter $logs,
    ) {}

    public function handle(User $user, CheckInData $data): AttendanceResult
    {
        if (! AttendanceConsent::hasCurrentConsent($user)) {
            throw AttendanceException::consentRequired();
        }

        $now = CarbonImmutable::now();
        $schedule = $this->pickSchedule($user, $now);
        $opensAt = $schedule->isWorkday() ? $schedule->checkInOpensAt() : null;

        if ($opensAt !== null && $now->lt($opensAt)) {
            throw AttendanceException::tooEarly($opensAt, $schedule->shift->name ?? '');
        }

        $location = $this->locations->verify($user, $schedule, $data);
        $flags = $this->fraud->detect($user, $data, $now);
        $selfiePath = $this->selfies->store($user, $data->selfie, $now);

        try {
            [$day, $log] = DB::transaction(function () use ($user, $data, $schedule, $location, $flags, $selfiePath, $now): array {
                $day = AttendanceDay::query()
                    ->where('user_id', $user->id)
                    ->whereDate('work_date', $schedule->workDateString())
                    ->lockForUpdate()
                    ->first() ?? new AttendanceDay(['user_id' => $user->id, 'work_date' => $schedule->workDateString()]);

                if ($day->check_in_at !== null) {
                    throw AttendanceException::alreadyCheckedIn($day->check_in_at);
                }

                $lateMinutes = self::lateMinutes($schedule, $now);

                $day->fill([
                    'shift_id' => $schedule->isWorkday() ? $schedule->shift?->id : null,
                    'scheduled_start' => $schedule->scheduledStart,
                    'scheduled_end' => $schedule->scheduledEnd,
                    'check_in_at' => $now->utc(),
                    'status' => self::status($schedule, $location, $lateMinutes),
                    'late_minutes' => $lateMinutes,
                ]);
                $day->save();

                $log = $this->logs->write($user, $day, AttendanceLogType::CheckIn, $data, $location, $flags, $selfiePath, $now);

                $day->check_in_log_id = $log->id;
                $day->is_suspicious = $day->is_suspicious || $log->is_suspicious;
                $day->save();

                return [$day, $log];
            });
        } catch (UniqueConstraintViolationException) {
            // A parallel request created the day first.
            $this->selfies->delete($selfiePath);
            $existing = AttendanceDay::query()->where('user_id', $user->id)->whereDate('work_date', $schedule->workDateString())->first();

            throw AttendanceException::alreadyCheckedIn($existing->check_in_at ?? $now);
        } catch (Throwable $exception) {
            $this->selfies->delete($selfiePath);

            throw $exception;
        }

        AttendanceRecorded::dispatch($day, $log);

        return new AttendanceResult($day, $log, $schedule, $location);
    }

    /**
     * Yesterday's overnight shift while it is still running (unless already
     * checked in), otherwise today.
     */
    private function pickSchedule(User $user, CarbonImmutable $now): DaySchedule
    {
        $candidates = $this->schedules->checkInCandidates($user, $now);
        $last = count($candidates) - 1;

        foreach ($candidates as $index => $candidate) {
            $existing = AttendanceDay::query()
                ->where('user_id', $user->id)
                ->whereDate('work_date', $candidate->workDateString())
                ->first();

            if ($existing === null) {
                return $candidate;
            }

            if ($existing->status->comesFromRequest()) {
                throw AttendanceException::dayHasRequest($existing->status);
            }

            if ($existing->check_in_at === null) {
                return $candidate;
            }

            if ($index === $last) {
                throw AttendanceException::alreadyCheckedIn($existing->check_in_at);
            }
        }

        return $candidates[$last];
    }

    /**
     * Whole minutes after the tolerance limit (mockup: "dihitung dari batas
     * toleransi 08.10"). Seconds within the limit minute are still on time.
     */
    public static function lateMinutes(DaySchedule $schedule, CarbonImmutable $now): int
    {
        $threshold = $schedule->isWorkday() ? $schedule->lateThreshold() : null;

        if ($threshold === null) {
            return 0;
        }

        $seconds = $now->getTimestamp() - $threshold->getTimestamp();

        return $seconds <= 0 ? 0 : intdiv($seconds, 60);
    }

    private static function status(DaySchedule $schedule, LocationVerdict $location, int $lateMinutes): AttendanceStatus
    {
        return match (true) {
            $lateMinutes > 0 => AttendanceStatus::Late,
            $location->method === AttendanceMethod::Wfh && $schedule->workMode !== WorkMode::Field => AttendanceStatus::Wfh,
            default => AttendanceStatus::Present,
        };
    }
}
