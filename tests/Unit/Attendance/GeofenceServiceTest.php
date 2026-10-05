<?php

use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Services\GeofenceService;

function location(string $name, float $lat, float $lng, int $radius): OfficeLocation
{
    return new OfficeLocation(['name' => $name, 'latitude' => $lat, 'longitude' => $lng, 'radius_m' => $radius]);
}

test('haversine distance of one degree of latitude', function () {
    $distance = (new GeofenceService)->distance(0, 0, 1, 0);

    expect($distance)->toEqualWithDelta(111_195.08, 0.5);
});

test('distance is zero for the same point and symmetric', function () {
    $service = new GeofenceService;

    expect($service->distance(-6.2, 106.816666, -6.2, 106.816666))->toBe(0.0)
        ->and($service->distance(-6.2, 106.8, -6.21, 106.83))->toEqualWithDelta($service->distance(-6.21, 106.83, -6.2, 106.8), 0.0001);
});

test('a known distance in Jakarta (Monas to Bundaran HI is about 2.2 km)', function () {
    $distance = (new GeofenceService)->distance(-6.175392, 106.827153, -6.194986, 106.823048);

    expect($distance)->toBeGreaterThan(2_150)->toBeLessThan(2_300);
});

test('the boundary of the radius counts as inside', function () {
    $office = location('Kantor Pusat', -6.2, 106.816666, 100);
    $service = new GeofenceService;
    $lat = -6.2 + 100 / 111_195.08;

    $match = $service->nearest([$office], $lat - 0.0000001, 106.816666);

    expect($match?->inside)->toBeTrue()
        ->and($service->nearest([$office], $lat + 0.00001, 106.816666)?->inside)->toBeFalse();
});

test('nearest prefers a location whose radius contains the point', function () {
    $small = location('Kantor kecil', -6.2, 106.816666, 50);
    $large = location('Gudang', -6.2030, 106.816666, 500);
    $point = [-6.2010, 106.816666]; // ~111 m from the small one, ~222 m from the large one

    $match = (new GeofenceService)->nearest([$small, $large], ...$point);

    expect($match?->location->name)->toBe('Gudang')
        ->and($match?->inside)->toBeTrue()
        ->and($match?->roundedDistance())->toBe(222);
});

test('nearest falls back to the closest location when outside every radius', function () {
    $a = location('A', -6.2, 106.816666, 100);
    $b = location('B', -6.3, 106.816666, 100);

    $match = (new GeofenceService)->nearest([$b, $a], -6.2031, 106.816666);

    expect($match?->location->name)->toBe('A')
        ->and($match?->inside)->toBeFalse()
        ->and($match?->roundedDistance())->toBe(345);
});

test('nearest returns null without locations', function () {
    expect((new GeofenceService)->nearest([], -6.2, 106.8))->toBeNull();
});
