<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Data\LocationVerdict;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Exceptions\AttendanceException;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Geofence rules per work mode (docs/ARCHITECTURE.md §3.1): inside a radius →
 * GPS + selfie; outside → rejected for office/hybrid days, accepted as WFH for
 * wfh/field employees or a WFH day (note required).
 */
final class LocationVerifier
{
    public function __construct(private readonly GeofenceService $geofence) {}

    public function verify(User $user, DaySchedule $schedule, CheckInData $data): LocationVerdict
    {
        $match = $this->geofence->nearest($this->allowedLocations($user, $schedule), $data->latitude, $data->longitude);

        if ($match !== null && $match->inside) {
            return new LocationVerdict(AttendanceMethod::GpsSelfie, $match);
        }

        if ($schedule->allowsRemoteCheckIn()) {
            if ($data->note === null || trim($data->note) === '') {
                throw AttendanceException::noteRequired();
            }

            return new LocationVerdict(AttendanceMethod::Wfh, $match);
        }

        if ($match === null) {
            throw AttendanceException::noOfficeLocation();
        }

        throw AttendanceException::outsideGeofence($match, $data->accuracyM);
    }

    /**
     * Active locations of the employee's company, or only the shift's own
     * location when the shift is bound to one.
     *
     * @return Collection<int, OfficeLocation>
     */
    public function allowedLocations(User $user, DaySchedule $schedule): Collection
    {
        $query = OfficeLocation::query()
            ->active()
            ->where('company_id', $user->company_id)
            ->orderBy('name');

        $shiftLocation = $schedule->shift?->office_location_id;

        if ($shiftLocation !== null) {
            $query->whereKey($shiftLocation);
        }

        return $query->get();
    }
}
