<?php

use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\FraudDetector;
use App\Domain\Attendance\Services\SelfieInspector;
use App\Models\User;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->detector = app(FraudDetector::class);
    $this->user = User::factory()->create();
    $this->travelTo(F::at('2026-10-05 08:00'));
});

function previousLog(User $user, array $attributes = []): AttendanceLog
{
    return AttendanceLog::factory()->forDay(AttendanceDay::factory()->for($user)->on('2026-10-02')->create())->create([
        'occurred_at' => now()->subHours(3),
        'latitude' => F::OFFICE_LAT,
        'longitude' => F::OFFICE_LNG,
        'device_fingerprint' => 'device-1',
        'ip_address' => '10.0.0.1',
        ...$attributes,
    ]);
}

test('a clean first check-in has no flags', function () {
    expect($this->detector->detect($this->user, F::data(), now()))->toBe([]);
});

test('GPS accuracy above 100 m is flagged', function () {
    expect($this->detector->detect($this->user, F::data(['accuracy' => 100.0]), now()))->toBe([])
        ->and($this->detector->detect($this->user, F::data(['accuracy' => 150.0]), now()))->toBe([LogFlag::LowAccuracy]);
});

test('a device clock off by more than five minutes is flagged', function () {
    expect($this->detector->detect($this->user, F::data(['client_time' => now()->subMinutes(4)->toImmutable()]), now()))->toBe([])
        ->and($this->detector->detect($this->user, F::data(['client_time' => now()->addMinutes(6)->toImmutable()]), now()))->toBe([LogFlag::ClockSkew]);
});

test('a new device and a new IP are flagged once there is history', function () {
    previousLog($this->user);

    expect($this->detector->detect($this->user, F::data(), now()))->toBe([])
        ->and($this->detector->detect($this->user, F::data(['device' => 'device-2', 'ip' => '10.9.9.9']), now()))
        ->toBe([LogFlag::NewDevice, LogFlag::NewIp]);
});

test('a new IP alone is recorded but not suspicious', function () {
    expect(FraudDetector::isSuspicious([LogFlag::NewIp]))->toBeFalse()
        ->and(FraudDetector::isSuspicious([LogFlag::NewIp, LogFlag::NewDevice]))->toBeTrue()
        ->and(FraudDetector::isSuspicious([]))->toBeFalse();
});

test('travelling faster than 150 km/h between logs is flagged', function () {
    // Bandung is ~120 km from Jakarta.
    previousLog($this->user, ['occurred_at' => now()->subMinutes(30)]);

    expect($this->detector->detect($this->user, F::data(['latitude' => -6.9175, 'longitude' => 107.6191]), now()))
        ->toContain(LogFlag::ImpossibleTravel);
});

test('plausible travel and GPS jitter are not flagged', function () {
    previousLog($this->user, ['occurred_at' => now()->subHours(3)]);

    expect($this->detector->detect($this->user, F::data(['latitude' => -6.9175, 'longitude' => 107.6191]), now()))->not->toContain(LogFlag::ImpossibleTravel)
        ->and($this->detector->detect($this->user, F::data(['latitude' => F::northOfOffice(400)]), now()->addSecond()))->not->toContain(LogFlag::ImpossibleTravel);
});

test('a dark or blank selfie is flagged', function () {
    expect($this->detector->detect($this->user, F::data(['selfie' => F::darkSelfie()]), now()))->toBe([LogFlag::DarkSelfie]);
});

test('the selfie inspector measures luminance and contrast', function () {
    $inspector = app(SelfieInspector::class);

    [$darkMean] = $inspector->luminance(F::darkSelfie()) ?? [255.0, 0.0];
    [$mean, $deviation] = $inspector->luminance(F::selfie()) ?? [0.0, 0.0];

    expect($darkMean)->toBeLessThan(10)
        ->and($mean)->toBeGreaterThan(80)
        ->and($deviation)->toBeGreaterThan(6)
        ->and($inspector->isDarkOrBlank(F::selfie()))->toBeFalse();
});
