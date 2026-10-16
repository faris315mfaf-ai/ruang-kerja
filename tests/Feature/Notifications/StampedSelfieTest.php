<?php

use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Services\StampedSelfie;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/*
 * The stamped selfie for the WhatsApp group (docs/fitur/absensi-whatsapp.md
 * §1b): a valid JPEG in memory with time, date, place and a mini map; map
 * tiles and the geocoder may fail without ever failing the photo.
 */
beforeEach(function () {
    Storage::fake('selfies');
    Cache::flush();
    Http::preventStrayRequests();
    config(['attendance.stamp.nominatim_interval_s' => 0, 'attendance.stamp.map' => true]);
});

function stampPng(): string
{
    $tile = imagecreatetruecolor(256, 256);
    imagefill($tile, 0, 0, imagecolorallocate($tile, 240, 236, 228));
    imageline($tile, 0, 0, 255, 255, imagecolorallocate($tile, 250, 200, 90));
    ob_start();
    imagepng($tile);

    return (string) ob_get_clean();
}

function storeStampSelfie(int $width = 640, int $height = 480): string
{
    $image = imagecreatetruecolor($width, $height);
    imagefill($image, 0, 0, imagecolorallocate($image, 120, 140, 160));
    imagefilledellipse($image, intdiv($width, 2), intdiv($height, 2), 160, 200, imagecolorallocate($image, 220, 180, 150));
    ob_start();
    imagejpeg($image, null, 90);
    Storage::disk('selfies')->put('2026/10/u/selfie.jpg', (string) ob_get_clean());

    return '2026/10/u/selfie.jpg';
}

/**
 * @param  array<string, mixed>  $attributes
 */
function stampLog(array $attributes = []): AttendanceLog
{
    $log = new AttendanceLog;
    $log->forceFill([
        'selfie_path' => $attributes['selfie_path'] ?? storeStampSelfie(),
        'latitude' => -6.2271,
        'longitude' => 106.8584,
        'occurred_at' => CarbonImmutable::parse('2026-10-06 17:38', 'Asia/Jakarta')->utc(),
        ...$attributes,
    ]);
    $log->method = AttendanceMethod::GpsSelfie;

    return $log;
}

function fakeOsm(): void
{
    Http::fake([
        'tile.openstreetmap.org/*' => Http::response(stampPng(), 200, ['Content-Type' => 'image/png']),
        'nominatim.openstreetmap.org/*' => Http::response(['address' => ['suburb' => 'Tebet Barat', 'city_district' => 'Tebet']]),
    ]);
}

test('it composes a valid JPEG from the stored selfie with map tiles and a geocoded place', function () {
    fakeOsm();

    $jpeg = app(StampedSelfie::class)->render(stampLog(), 'Luar kantor · 2 km dari Kantor Pusat');
    $info = getimagesizefromstring((string) $jpeg);

    expect($jpeg)->toBeString()
        ->and($info['mime'])->toBe('image/jpeg')
        ->and([$info[0], $info[1]])->toBe([640, 480]);

    Http::assertSent(fn (Request $r): bool => str_starts_with($r->url(), 'https://tile.openstreetmap.org/16/')
        && str_contains($r->header('User-Agent')[0], 'RuangKerja/1.0'));
    Http::assertSent(fn (Request $r): bool => str_starts_with($r->url(), 'https://nominatim.openstreetmap.org/reverse')
        && $r['format'] === 'jsonv2' && $r['accept-language'] === 'id'
        && str_contains($r->header('User-Agent')[0], 'RuangKerja/1.0'));
});

test('a wide selfie is scaled down to the maximum width and the original stays untouched', function () {
    fakeOsm();
    $path = storeStampSelfie(2000, 1500);
    $before = Storage::disk('selfies')->get($path);

    $info = getimagesizefromstring((string) app(StampedSelfie::class)->render(stampLog(['selfie_path' => $path]), '—'));

    expect([$info[0], $info[1]])->toBe([1080, 810])
        ->and(Storage::disk('selfies')->get($path))->toBe($before);
});

test('tile and geocoder failures degrade to a map-less photo with the fallback place', function () {
    Http::fake([
        'tile.openstreetmap.org/*' => Http::response(status: 500),
        'nominatim.openstreetmap.org/*' => fn () => throw new ConnectionException('timeout'),
    ]);
    $stamper = app(StampedSelfie::class);
    $log = stampLog();

    $jpeg = $stamper->render($log, 'Luar kantor · 2 km dari Kantor Pusat');

    expect(getimagesizefromstring((string) $jpeg)['mime'])->toBe('image/jpeg')
        ->and($stamper->placeName($log, 'Luar kantor · 2 km dari Kantor Pusat'))->toBe('Luar kantor · 2 km dari Kantor Pusat');
});

test('the place name is the neighbourhood from Nominatim and is cached by rounded coordinates', function () {
    fakeOsm();
    $stamper = app(StampedSelfie::class);

    expect($stamper->placeName(stampLog(), 'x'))->toBe('Tebet Barat')
        ->and($stamper->placeName(stampLog(['latitude' => -6.22712, 'longitude' => 106.85841]), 'x'))->toBe('Tebet Barat');

    Http::assertSentCount(1);
});

test('an office geofence and WFH never call the geocoder', function () {
    fakeOsm();
    $stamper = app(StampedSelfie::class);
    $office = new OfficeLocation(['name' => 'Kantor Pusat']);

    $atOffice = stampLog();
    $atOffice->setRelation('officeLocation', $office);
    $wfh = stampLog();
    $wfh->method = AttendanceMethod::Wfh;

    expect($stamper->placeName($atOffice, 'x'))->toBe('Kantor Pusat')
        ->and($stamper->placeName($wfh, 'x'))->toBe('WFH');

    Http::assertNothingSent();
});

test('with the map switched off no OpenStreetMap request is made', function () {
    fakeOsm();
    config(['attendance.stamp.map' => false]);

    $jpeg = app(StampedSelfie::class)->render(stampLog(), 'Luar kantor');

    expect(getimagesizefromstring((string) $jpeg)['mime'])->toBe('image/jpeg');
    Http::assertNothingSent();
});

test('it returns null without a selfie, with a missing file or with garbage bytes', function () {
    $stamper = app(StampedSelfie::class);

    expect($stamper->render(stampLog(['selfie_path' => null]), 'x'))->toBeNull()
        ->and($stamper->render(stampLog(['selfie_path' => 'tidak/ada.jpg']), 'x'))->toBeNull();

    Storage::disk('selfies')->put('rusak.jpg', 'bukan gambar');
    expect($stamper->render(stampLog(['selfie_path' => 'rusak.jpg']), 'x'))->toBeNull();
});
