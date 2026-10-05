<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Data\GeofenceMatch;
use App\Domain\Attendance\Models\OfficeLocation;

/**
 * Great-circle distance (haversine) between the device and office geofences.
 */
final class GeofenceService
{
    /**
     * Mean Earth radius (IUGG), metres.
     */
    public const float EARTH_RADIUS_M = 6_371_008.8;

    public function distance(float $fromLat, float $fromLng, float $toLat, float $toLng): float
    {
        $dLat = deg2rad($toLat - $fromLat);
        $dLng = deg2rad($toLng - $fromLng);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat)) * sin($dLng / 2) ** 2;

        return 2 * self::EARTH_RADIUS_M * asin(min(1.0, sqrt($a)));
    }

    /**
     * The best matching location: the closest one whose radius contains the
     * point, otherwise the closest one overall. Null when there are none.
     *
     * @param  iterable<OfficeLocation>  $locations
     */
    public function nearest(iterable $locations, float $latitude, float $longitude): ?GeofenceMatch
    {
        $bestInside = null;
        $bestOverall = null;

        foreach ($locations as $location) {
            $distance = $this->distance($latitude, $longitude, $location->latitude, $location->longitude);
            $match = new GeofenceMatch($location, $distance, $distance <= $location->radius_m);

            if ($match->inside && ($bestInside === null || $distance < $bestInside->distanceM)) {
                $bestInside = $match;
            }

            if ($bestOverall === null || $distance < $bestOverall->distanceM) {
                $bestOverall = $match;
            }
        }

        return $bestInside ?? $bestOverall;
    }
}
