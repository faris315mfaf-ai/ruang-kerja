<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\AttendanceResult;
use App\Domain\Attendance\Data\AttendanceWindows;
use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Data\LocationVerdict;
use App\Domain\Attendance\Data\QrCheckInData;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Jobs\CreateWorkPlanTasksForDay;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\AttendanceLogWriter;
use App\Domain\Attendance\Services\PresenceVerifier;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Domain\Notifications\Jobs\SendAttendanceWhatsApp;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Check-in (docs/ARCHITECTURE.md §3.1, §3.2): consent → schedule → GPS
 * geofence or kiosk QR → fraud flags → private selfie (GPS only) → log + day
 * in one transaction → broadcast.
 */
final class CheckIn
{
    /** Unique index of attendance_days (user_id, work_date): a parallel check-in won the race. */
    private const string DAY_UNIQUE_INDEX = 'attendance_days_user_id_work_date_unique';

    public function __construct(
        private readonly ScheduleResolver $schedules,
        private readonly PresenceVerifier $presence,
        private readonly SelfieStorage $selfies,
        private readonly AttendanceLogWriter $logs,
        private readonly EvolutionWhatsApp $whatsapp,
    ) {}

    public function handle(User $user, CheckInData|QrCheckInData $data): AttendanceResult
    {
        if (! AttendanceConsent::hasCurrentConsent($user)) {
            throw AttendanceException::consentRequired();
        }

        $now = CarbonImmutable::now();
        [$schedule, $existing] = $this->pickSchedule($user, $now);

        if ($existing?->status === AttendanceStatus::BusinessTrip) {
            $schedule = $schedule->asBusinessTrip();
        }

        // Company "jam absen" (Admin): replaces the shift's opening window when it
        // has a lower bound, and closes check-in after its upper bound. Day shifts only.
        $windows = AttendanceWindows::forUser($user);
        $windowsApply = $windows->appliesTo($schedule);
        $phase = $windowsApply ? $windows->checkInPhase($now) : null;

        if ($phase !== null) {
            throw AttendanceException::checkInWindow($windows, $phase, $windows->checkInOpensAt($now));
        }

        $opensAt = $schedule->isWorkday() && ! ($windowsApply && $windows->checkInFrom !== null) ? $schedule->checkInOpensAt() : null;

        if ($opensAt !== null && $now->lt($opensAt)) {
            throw AttendanceException::tooEarly($opensAt, $schedule->shift->name ?? '');
        }

        [$location, $qr, $flags] = $this->presence->verify($user, $schedule, $data, $now);
        $selfiePath = $data instanceof CheckInData ? $this->selfies->store($user, $data->selfie, $now) : null;

        try {
            [$day, $log] = DB::transaction(function () use ($user, $data, $schedule, $location, $qr, $flags, $selfiePath, $now): array {
                $day = AttendanceDay::query()
                    ->where('user_id', $user->id)
                    ->whereDate('work_date', $schedule->workDateString())
                    ->lockForUpdate()
                    ->first() ?? new AttendanceDay(['user_id' => $user->id, 'work_date' => $schedule->workDateString()]);

                if ($day->check_in_at !== null) {
                    throw AttendanceException::alreadyCheckedIn($day->check_in_at);
                }

                // A half-day leave/permit or business trip keeps its request status
                // and request_id; the request explains the hours, so never "late".
                $fromRequest = $day->exists && $day->isFromRequest();
                $lateMinutes = $fromRequest ? 0 : self::lateMinutes($schedule, $now);

                $day->fill([
                    'work_plan' => $data instanceof CheckInData && $data->workPlan !== [] ? $data->workPlan : null,
                    'shift_id' => $schedule->isWorkday() ? $schedule->shift?->id : null,
                    'scheduled_start' => $schedule->scheduledStart,
                    'scheduled_end' => $schedule->scheduledEnd,
                    'check_in_at' => $now->utc(),
                    'status' => $fromRequest ? $day->status : self::status($schedule, $location, $lateMinutes),
                    'late_minutes' => $lateMinutes,
                ]);
                $day->save();

                $log = $this->logs->write($user, $day, AttendanceLogType::CheckIn, $data, $location, $flags, $selfiePath, $now, $qr);

                $day->check_in_log_id = $log->id;
                $day->is_suspicious = $day->is_suspicious || $log->is_suspicious;
                $day->save();

                return [$day, $log];
            });
        } catch (UniqueConstraintViolationException $exception) {
            $this->deleteSelfie($selfiePath);

            if (! str_contains($exception->getMessage(), self::DAY_UNIQUE_INDEX)) {
                throw $exception;
            }

            // A parallel request created the day first.
            $existing = AttendanceDay::query()->where('user_id', $user->id)->whereDate('work_date', $schedule->workDateString())->first();

            throw AttendanceException::alreadyCheckedIn($existing->check_in_at ?? $now);
        } catch (Throwable $exception) {
            $this->deleteSelfie($selfiePath);

            throw $exception;
        }

        AttendanceRecorded::dispatch($day, $log);

        // "Rencana kerja jadi tugas otomatis" (keputusan pemilik 9 Okt 2026):
        // one task per work-plan point in the personal workspace. Runs after
        // the check-in committed (queued, idempotent per day) so a failure in
        // the task chain never undoes the check-in.
        if ($day->work_plan !== null && $day->work_plan !== []) {
            try {
                CreateWorkPlanTasksForDay::dispatch($day->id)->afterCommit();
            } catch (Throwable $exception) {
                // The check-in is committed; a failing task chain (or queue)
                // is reported, never turned into a failed check-in.
                report($exception);
            }
        }

        // Best-effort copy to the management WhatsApp group (Evolution API);
        // queued only while the channel is on, never blocks the check-in.
        if ($this->whatsapp->enabled() && (string) config('notifications.channels.whatsapp.group_jid') !== '') {
            SendAttendanceWhatsApp::dispatch($day->id, AttendanceLogType::CheckIn);
        }

        return new AttendanceResult($day, $log, $schedule, $location);
    }

    /**
     * Yesterday's overnight shift while it is still running (unless already
     * checked in), otherwise today — with the existing attendance row, if any.
     *
     * @return array{0: DaySchedule, 1: AttendanceDay|null}
     */
    private function pickSchedule(User $user, CarbonImmutable $now): array
    {
        $candidates = $this->schedules->checkInCandidates($user, $now);
        $last = count($candidates) - 1;
        $existing = null;

        foreach ($candidates as $index => $candidate) {
            $existing = AttendanceDay::query()
                ->where('user_id', $user->id)
                ->whereDate('work_date', $candidate->workDateString())
                ->first();

            if ($existing === null) {
                return [$candidate, null];
            }

            // Full-day leave/permit/sick: no check-in. Half days and business trips may.
            if ($existing->blocksCheckIn()) {
                throw AttendanceException::dayHasRequest($existing->status);
            }

            if ($existing->check_in_at === null) {
                return [$candidate, $existing];
            }

            if ($index === $last) {
                throw AttendanceException::alreadyCheckedIn($existing->check_in_at);
            }
        }

        return [$candidates[$last], $existing];
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

    private function deleteSelfie(?string $path): void
    {
        if ($path !== null) {
            $this->selfies->delete($path);
        }
    }
}
