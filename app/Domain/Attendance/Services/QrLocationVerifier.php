<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Data\GeofenceMatch;
use App\Domain\Attendance\Data\LocationVerdict;
use App\Domain\Attendance\Data\QrCheckInData;
use App\Domain\Attendance\Data\QrVerdict;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * QR kiosk check-in: the scanned code proves presence at the kiosk location,
 * which must be one the employee may check in at (same rules as GPS). GPS is
 * only recorded; a position far from the kiosk is flagged, never blocked. A
 * scan without GPS is flagged `qr_no_location` (a forwarded code), or refused
 * when `attendance.qr.require_location` is on.
 */
final class QrLocationVerifier
{
    public function __construct(
        private readonly QrCodeService $codes,
        private readonly LocationVerifier $locations,
        private readonly GeofenceService $geofence,
    ) {}

    public function verify(User $user, DaySchedule $schedule, QrCheckInData $data, CarbonInterface $now): QrVerdict
    {
        $token = $this->codes->verify($data->payload, $now);
        $location = $token->officeLocation;
        $allowed = $this->locations->allowedLocations($user, $schedule);

        if ($location->company_id !== $user->company_id || ! $allowed->contains('id', $location->id)) {
            throw AttendanceException::qrWrongLocation(
                $location->name,
                array_values($allowed->map(fn (OfficeLocation $allowedLocation): string => $allowedLocation->name)->all()),
            );
        }

        $hasLocation = $data->latitude !== null && $data->longitude !== null;

        if (! $hasLocation && config()->boolean('attendance.qr.require_location')) {
            throw AttendanceException::qrLocationRequired();
        }

        $distance = $hasLocation
            ? $this->geofence->distance($location->latitude, $location->longitude, $data->latitude, $data->longitude)
            : null;
        $flags = [];

        if ($distance === null) {
            // A forwarded photo of the kiosk code works anywhere; nothing proves presence.
            $flags[] = LogFlag::QrNoLocation;
        } elseif ($distance > $location->radius_m + max(0.0, $data->accuracyM ?? 0.0)) {
            $flags[] = LogFlag::QrLocationMismatch;
        }

        return new QrVerdict(
            new LocationVerdict(AttendanceMethod::Qr, new GeofenceMatch($location, $distance ?? 0.0, inside: true)),
            $token,
            $distance,
            $flags,
        );
    }
}
