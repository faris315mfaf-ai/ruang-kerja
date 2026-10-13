<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Data\QrCheckInData;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Offline attendance of the mobile app (owner decision 14 Oct 2026): the
 * check-in/out pressed without internet is judged at the DEVICE time of the
 * press (`offline_at`) — work date, schedule, lateness, company windows,
 * `occurred_at` — and flagged `offline` for HR review. Accepted when the
 * device time is at most MAX_FUTURE_MINUTES ahead of the server and at most
 * MAX_AGE_HOURS old.
 */
final class OfflineAttendance
{
    public const int MAX_AGE_HOURS = 72;

    public const int MAX_FUTURE_MINUTES = 5;

    /**
     * The instant the request is judged at: the device time of an offline
     * press, otherwise the server time of receipt.
     *
     * @throws AttendanceException offline_clock_invalid | offline_expired
     */
    public static function instant(CheckInData|QrCheckInData $data, CarbonImmutable $received): CarbonImmutable
    {
        if (! $data->offline) {
            return $received;
        }

        $at = $data->offlineAt ?? throw AttendanceException::offlineClockInvalid();

        if ($at->gt($received->addMinutes(self::MAX_FUTURE_MINUTES))) {
            throw AttendanceException::offlineClockInvalid();
        }

        if ($at->lt($received->subHours(self::MAX_AGE_HOURS))) {
            throw AttendanceException::offlineExpired();
        }

        return $at;
    }

    /**
     * Anti time-travel: a device that already synced an offline log of the
     * same type with a LATER device time cannot sync an earlier one (queued
     * presses must be sent in the order they were made).
     *
     * @throws AttendanceException offline_clock_invalid
     */
    public static function assertInOrder(User $user, CheckInData|QrCheckInData $data, AttendanceLogType $type, CarbonImmutable $at): void
    {
        if (! $data->offline || $data->deviceFingerprint === null) {
            return;
        }

        $later = AttendanceLog::query()
            ->where('user_id', $user->id)
            ->where('type', $type)
            ->where('device_fingerprint', $data->deviceFingerprint)
            ->whereNotNull('received_at')
            ->where('occurred_at', '>', $at)
            ->exists();

        if ($later) {
            throw AttendanceException::offlineClockInvalid();
        }
    }
}
