<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Data\LocationVerdict;
use App\Domain\Attendance\Data\QrCheckInData;
use App\Domain\Attendance\Data\QrVerdict;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Where was the employee? GPS geofence rules for a selfie check-in, the
 * scanned kiosk code for a QR check-in. Fraud flags of both are merged.
 */
final class PresenceVerifier
{
    public function __construct(
        private readonly LocationVerifier $gps,
        private readonly QrLocationVerifier $qr,
        private readonly FraudDetector $fraud,
    ) {}

    /**
     * @return array{0: LocationVerdict, 1: QrVerdict|null, 2: list<LogFlag>}
     *
     * @throws AttendanceException
     */
    public function verify(User $user, DaySchedule $schedule, CheckInData|QrCheckInData $data, CarbonImmutable $now): array
    {
        if ($data instanceof QrCheckInData) {
            $verdict = $this->qr->verify($user, $schedule, $data, $now);

            return [$verdict->location, $verdict, [...$this->fraud->detect($user, $data, $now), ...$verdict->flags]];
        }

        return [$this->gps->verify($user, $schedule, $data), null, $this->fraud->detect($user, $data, $now)];
    }
}
