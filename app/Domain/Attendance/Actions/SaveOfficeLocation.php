<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\OfficeLocation;
use App\Models\User;

/**
 * Creates or updates a geofence (audited through the Auditable trait).
 */
final class SaveOfficeLocation
{
    /**
     * @param  array{name: string, address?: string|null, latitude: float, longitude: float, radius_m: int, is_active: bool}  $attributes
     */
    public function handle(User $actor, array $attributes, ?OfficeLocation $location = null): OfficeLocation
    {
        $location ??= new OfficeLocation(['company_id' => $actor->company_id]);

        $location->fill([
            'name' => trim($attributes['name']),
            'address' => isset($attributes['address']) ? trim($attributes['address']) : null,
            'latitude' => round($attributes['latitude'], 7),
            'longitude' => round($attributes['longitude'], 7),
            'radius_m' => $attributes['radius_m'],
            'is_active' => $attributes['is_active'],
        ]);
        $location->save();

        return $location;
    }
}
