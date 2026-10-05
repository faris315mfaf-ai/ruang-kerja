<?php

namespace Tests\Support;

use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Data\CheckInData;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shared fixtures for attendance tests. Times are written in office time
 * (Asia/Jakarta, UTC+7).
 */
final class AttendanceFixtures
{
    /** Kantor Pusat (mockup LokasiShift). */
    public const float OFFICE_LAT = -6.2;

    public const float OFFICE_LNG = 106.816666;

    /**
     * A JPEG with a gradient + noise, so it is neither dark nor blank.
     */
    public static function selfie(string $name = 'selfie.jpg'): UploadedFile
    {
        return self::jpeg($name, function ($image, int $width, int $height): void {
            for ($x = 0; $x < $width; $x += 4) {
                for ($y = 0; $y < $height; $y += 4) {
                    $shade = (int) (80 + 120 * ($x / $width) + random_int(0, 40));
                    $color = imagecolorallocate($image, $shade, (int) ($shade * 0.9), (int) ($shade * 0.8));
                    imagefilledrectangle($image, $x, $y, $x + 3, $y + 3, $color === false ? 0 : $color);
                }
            }
        });
    }

    /**
     * An almost black JPEG (camera covered).
     */
    public static function darkSelfie(): UploadedFile
    {
        return self::jpeg('dark.jpg', function ($image, int $width, int $height): void {
            $color = imagecolorallocate($image, 6, 6, 8);
            imagefilledrectangle($image, 0, 0, $width, $height, $color === false ? 0 : $color);
        });
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    public static function data(array $overrides = []): CheckInData
    {
        $values = [
            'latitude' => self::OFFICE_LAT,
            'longitude' => self::OFFICE_LNG,
            'accuracy' => 12.0,
            'client_time' => CarbonImmutable::now(),
            'selfie' => self::selfie(),
            'device' => 'device-1',
            'ip' => '10.0.0.1',
            'note' => null,
            ...$overrides,
        ];

        return new CheckInData(
            latitude: (float) $values['latitude'],
            longitude: (float) $values['longitude'],
            accuracyM: $values['accuracy'] === null ? null : (float) $values['accuracy'],
            clientTime: $values['client_time'] instanceof CarbonImmutable ? $values['client_time'] : null,
            selfie: $values['selfie'] instanceof UploadedFile ? $values['selfie'] : self::selfie(),
            deviceFingerprint: is_string($values['device']) ? $values['device'] : null,
            ipAddress: is_string($values['ip']) ? $values['ip'] : null,
            userAgent: 'Pest',
            note: is_string($values['note']) ? $values['note'] : null,
        );
    }

    /**
     * Metres north of the office (0.000009° latitude ≈ 1 m).
     */
    public static function northOfOffice(float $metres): float
    {
        return self::OFFICE_LAT + $metres / 111_195.08;
    }

    public static function office(int $radius = 100): OfficeLocation
    {
        return OfficeLocation::factory()->at(self::OFFICE_LAT, self::OFFICE_LNG, $radius)->create(['name' => 'Kantor Pusat']);
    }

    /**
     * Employee with consent and a Monday–Friday 08.00–17.00 pattern.
     */
    public static function employee(WorkMode $mode = WorkMode::Office, ?Shift $shift = null, bool $consent = true): User
    {
        $user = User::factory()->workMode($mode)->create();
        $shift ??= Shift::factory()->create();

        ShiftAssignment::factory()->for($user)->for($shift)->between('2026-01-01')->create();

        if ($consent) {
            app(GiveAttendanceConsent::class)->handle($user);
        }

        return $user;
    }

    /**
     * POST a check-in (or check-out) as the user, ~33 m from the office.
     *
     * @param  array<string, mixed>  $fields
     * @return TestResponse<Response>
     */
    public static function checkIn(User $user, array $fields = [], string $type = 'in'): TestResponse
    {
        return test()->actingAs($user)
            ->withHeader('Accept', 'application/json')
            ->post(route($type === 'in' ? 'attendance.check-in' : 'attendance.check-out'), [
                'latitude' => self::OFFICE_LAT + 0.0003,
                'longitude' => self::OFFICE_LNG,
                'accuracy' => 12,
                'client_time' => now()->toIso8601String(),
                'selfie' => self::selfie(),
                'device_id' => 'device-1',
                ...$fields,
            ]);
    }

    /**
     * POST a scanned kiosk QR payload as the user (GPS ~33 m from the office
     * unless overridden; pass latitude/longitude null to omit it).
     *
     * @param  array<string, mixed>  $fields
     * @return TestResponse<Response>
     */
    public static function scanQr(User $user, string $payload, array $fields = [], string $type = 'in'): TestResponse
    {
        $data = array_filter([
            'payload' => $payload,
            'latitude' => self::OFFICE_LAT + 0.0003,
            'longitude' => self::OFFICE_LNG,
            'accuracy' => 12,
            'client_time' => now()->toIso8601String(),
            'device_id' => 'device-1',
            ...$fields,
        ], fn (mixed $value): bool => $value !== null);

        return test()->actingAs($user)
            ->withHeader('Accept', 'application/json')
            ->post(route($type === 'in' ? 'attendance.check-in.qr' : 'attendance.check-out.qr'), $data);
    }

    /**
     * Office time "2026-10-05 08:00" → instant.
     */
    public static function at(string $officeTime): CarbonImmutable
    {
        return CarbonImmutable::parse($officeTime, 'Asia/Jakarta');
    }

    /**
     * @param  callable(\GdImage, int, int): void  $paint
     */
    private static function jpeg(string $name, callable $paint): UploadedFile
    {
        $width = 240;
        $height = 320;
        $image = imagecreatetruecolor($width, $height);

        if ($image === false) {
            throw new RuntimeException('GD tidak tersedia.');
        }

        $paint($image, $width, $height);

        $path = tempnam(sys_get_temp_dir(), 'selfie');

        if ($path === false) {
            throw new RuntimeException('Tidak bisa membuat berkas sementara.');
        }

        imagejpeg($image, $path, 80);

        return new UploadedFile($path, $name, 'image/jpeg', null, true);
    }
}
