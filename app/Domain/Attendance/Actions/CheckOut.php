<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\AttendanceResult;
use App\Domain\Attendance\Data\AttendanceWindows;
use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Data\QrCheckInData;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Services\AttendanceLogWriter;
use App\Domain\Attendance\Services\OpenDayLocator;
use App\Domain\Attendance\Services\PresenceVerifier;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Domain\Notifications\Jobs\SendAttendanceWhatsApp;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * GPS + selfie or kiosk QR check-out of the open day (today, or yesterday's overnight /
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
        private readonly PresenceVerifier $presence,
        private readonly SelfieStorage $selfies,
        private readonly AttendanceLogWriter $logs,
        private readonly OpenDayLocator $openDays,
        private readonly EvolutionWhatsApp $whatsapp,
    ) {}

    public function handle(User $user, CheckInData|QrCheckInData $data): AttendanceResult
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

        // Company "jam absen" (Admin): check-out only within [from, until]. Skipped for
        // overnight shifts and for a day opened yesterday (late check-out).
        $windows = AttendanceWindows::forUser($user);
        $isToday = $openDay->work_date->toDateString() === ScheduleResolver::officeDate($now)->toDateString();
        $phase = $isToday && $windows->appliesTo($schedule) && $openDay->shift?->crosses_midnight !== true ? $windows->checkOutPhase($now) : null;

        if ($phase !== null) {
            throw AttendanceException::checkOutWindow($windows, $phase);
        }

        [$location, $qr, $flags] = $this->presence->verify($user, $schedule, $data, $now);
        $selfiePath = $data instanceof CheckInData ? $this->selfies->store($user, $data->selfie, $now) : null;

        try {
            [$day, $log] = DB::transaction(function () use ($user, $data, $openDay, $location, $qr, $flags, $selfiePath, $now): array {
                $day = AttendanceDay::query()->whereKey($openDay->id)->lockForUpdate()->firstOrFail();

                if ($day->check_out_at !== null) {
                    throw AttendanceException::alreadyCheckedOut($day->check_out_at);
                }

                $log = $this->logs->write($user, $day, AttendanceLogType::CheckOut, $data, $location, $flags, $selfiePath, $now, $qr);
                // Half-day leave/permit or business trip: the request explains the hours.
                $earlyMinutes = $day->isFromRequest() ? 0 : self::earlyLeaveMinutes($day, $now);

                $day->fill([
                    'check_out_at' => $now->utc(),
                    'check_out_log_id' => $log->id,
                    'early_leave_minutes' => $earlyMinutes,
                    'work_minutes' => self::workMinutes($day, $now),
                    'is_suspicious' => $day->is_suspicious || $log->is_suspicious,
                ]);

                // Laporan kerja (what was done today); a QR check-out has no form and keeps the column null.
                if ($data instanceof CheckInData && $data->workReport !== null && $data->workReport !== []) {
                    $day->work_report = $data->workReport;
                }

                if ($earlyMinutes > 0 && in_array($day->status, [AttendanceStatus::Present, AttendanceStatus::Wfh], true)) {
                    $day->status = AttendanceStatus::EarlyLeave;
                }

                $day->save();

                return [$day, $log];
            });
        } catch (Throwable $exception) {
            $this->deleteSelfie($selfiePath);

            throw $exception;
        }

        AttendanceRecorded::dispatch($day, $log);

        // Afternoon copy to the management group: duration, not the plan.
        if ($this->whatsapp->enabled() && (string) config('notifications.channels.whatsapp.group_jid') !== '') {
            SendAttendanceWhatsApp::dispatch($day->id, AttendanceLogType::CheckOut);
        }

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

    private function deleteSelfie(?string $path): void
    {
        if ($path !== null) {
            $this->selfies->delete($path);
        }
    }
}
