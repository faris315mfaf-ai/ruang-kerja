<?php

use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\QrToken;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Services\QrCodeService;
use App\Models\Company;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->office = F::office();
    $this->kiosk = Kiosk::factory()->at($this->office)->paired()->create(['name' => 'Lobi', 'code' => 'KP-LOBI']);
    $this->codes = app(QrCodeService::class);
    // 07:52:00 is the start of a 30-second window.
    $this->travelTo(F::at('2026-10-05 07:52:00'));
});

function displayedCode(Kiosk $kiosk): string
{
    return app(QrCodeService::class)->issue($kiosk, now())->payload;
}

test('a displayed QR code checks the employee in with method qr and records GPS', function () {
    $user = F::employee();
    $payload = displayedCode($this->kiosk);

    expect($payload)->toStartWith('ruangkerja://checkin?l='.$this->office->id.'&w=');

    F::scanQr($user, $payload)->assertCreated()
        ->assertJsonPath('result.method', 'qr')
        ->assertJsonPath('result.methodLabel', 'QR kiosk')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.location.name', 'Kantor Pusat')
        ->assertJsonPath('result.location.distanceM', 33)
        ->assertJsonPath('result.selfieUrl', null);

    $log = AttendanceLog::query()->sole();
    $token = QrToken::query()->sole();

    expect($log->method)->toBe(AttendanceMethod::Qr)
        ->and($log->qr_token_id)->toBe($token->id)
        ->and($token->kiosk_id)->toBe($this->kiosk->id)
        ->and($log->office_location_id)->toBe($this->office->id)
        ->and($log->latitude)->toBe(round(F::OFFICE_LAT + 0.0003, 7))
        ->and($log->distance_m)->toBeGreaterThan(30.0)
        ->and($log->selfie_path)->toBeNull()
        ->and($log->flags)->toBeEmpty()
        ->and(AttendanceDay::query()->sole()->status)->toBe(AttendanceStatus::Present);

    expect(Storage::disk('selfies')->allFiles())->toBeEmpty();
    Event::assertDispatched(AttendanceRecorded::class);
});

test('GPS is optional for a QR scan', function () {
    $user = F::employee();

    F::scanQr($user, displayedCode($this->kiosk), ['latitude' => null, 'longitude' => null, 'accuracy' => null])
        ->assertCreated()
        ->assertJsonPath('result.location.distanceM', null);

    $log = AttendanceLog::query()->sole();

    expect($log->latitude)->toBeNull()->and($log->distance_m)->toBeNull()->and($log->is_suspicious)->toBeFalse();
});

test('a late QR check-in counts late minutes like GPS', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 08:25:00'));

    F::scanQr($user, displayedCode($this->kiosk))->assertCreated()
        ->assertJsonPath('result.status', 'late')
        ->assertJsonPath('result.lateMinutes', 15);
});

test('the previous window is still accepted (± 1 window)', function () {
    $user = F::employee();
    $payload = displayedCode($this->kiosk);

    $this->travel(30)->seconds();
    F::scanQr($user, $payload)->assertCreated();
});

test('an expired QR code is rejected', function () {
    $user = F::employee();
    $payload = displayedCode($this->kiosk);

    $this->travel(60)->seconds();

    F::scanQr($user, $payload)->assertUnprocessable()
        ->assertJsonPath('reason', 'qr_expired')
        ->assertJsonPath('message', 'Kode QR sudah kedaluwarsa. Pindai kode terbaru di layar kiosk (berganti tiap 30 detik).');

    expect(AttendanceDay::query()->count())->toBe(0)->and(AttendanceLog::query()->count())->toBe(0);
});

test('a forged HMAC is rejected', function (string $forgery) {
    $user = F::employee();
    $payload = displayedCode($this->kiosk);
    $office = $this->office->id;
    $window = $this->codes->window(now());

    $payload = match ($forgery) {
        'tampered signature' => substr($payload, 0, -1).(str_ends_with($payload, 'a') ? 'b' : 'a'),
        'signed with another secret' => "ruangkerja://checkin?l={$office}&w={$window}&s=".substr(hash_hmac('sha256', $office.'|'.$window, 'not-the-secret'), 0, 32),
        'signature of another window' => "ruangkerja://checkin?l={$office}&w={$window}&s=".$this->codes->sign($office, $window - 5),
        default => 'https://contoh.test/promo',
    };

    F::scanQr($user, $payload)->assertUnprocessable()
        ->assertJsonPath('reason', 'qr_invalid')
        ->assertJsonPath('message', 'Kode QR tidak dikenali. Pindai kode yang tampil di layar kiosk RuangKerja.');

    expect(AttendanceLog::query()->count())->toBe(0);
})->with(['tampered signature', 'signed with another secret', 'signature of another window', 'not a RuangKerja code']);

test('a correctly signed code that no kiosk displayed is rejected', function () {
    $user = F::employee();
    $payload = $this->codes->payload($this->office->id, $this->codes->window(now()));

    F::scanQr($user, $payload)->assertUnprocessable()->assertJsonPath('reason', 'qr_invalid');
});

test('a code from a future window is rejected', function () {
    $user = F::employee();
    $future = $this->codes->issue($this->kiosk, now()->addMinutes(2))->payload;

    F::scanQr($user, $future)->assertUnprocessable()->assertJsonPath('reason', 'qr_invalid');
});

test('codes of a deactivated kiosk are rejected', function () {
    $user = F::employee();
    $payload = displayedCode($this->kiosk);
    $this->kiosk->update(['is_active' => false]);

    F::scanQr($user, $payload)->assertUnprocessable()->assertJsonPath('reason', 'qr_invalid');
});

test('a kiosk at a location the shift does not allow is rejected', function () {
    $warehouse = OfficeLocation::factory()->at(-6.3135, 107.1465, 150)->create(['name' => 'Gudang Cikarang']);
    $user = F::employee(shift: Shift::factory()->create(['office_location_id' => $warehouse->id]));

    F::scanQr($user, displayedCode($this->kiosk))->assertUnprocessable()
        ->assertJsonPath('reason', 'qr_wrong_location')
        ->assertJsonPath('message', 'Kode QR ini untuk Kantor Pusat. Check-in Anda di Gudang Cikarang.');
});

test('a kiosk of another company is rejected', function () {
    $other = Company::factory()->create();
    $foreignOffice = OfficeLocation::factory()->forCompany($other)->at(F::OFFICE_LAT, F::OFFICE_LNG)->create(['name' => 'Kantor Lain']);
    $foreignKiosk = Kiosk::factory()->at($foreignOffice)->paired()->create();
    $user = F::employee();

    F::scanQr($user, displayedCode($foreignKiosk))->assertUnprocessable()->assertJsonPath('reason', 'qr_wrong_location');
});

test('GPS far from the kiosk is flagged for review but not blocked', function () {
    $user = F::employee();

    F::scanQr($user, displayedCode($this->kiosk), ['latitude' => F::northOfOffice(25_000)])
        ->assertCreated()
        ->assertJsonPath('result.isSuspicious', true);

    $log = AttendanceLog::query()->sole();

    expect($log->flags->all())->toContain(LogFlag::QrLocationMismatch)
        ->and($log->is_suspicious)->toBeTrue()
        ->and(AttendanceDay::query()->sole()->is_suspicious)->toBeTrue();
});

test('QR check-out closes the day', function () {
    $user = F::employee();
    F::scanQr($user, displayedCode($this->kiosk))->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05:00'));
    F::scanQr($user, displayedCode($this->kiosk), type: 'out')->assertCreated()
        ->assertJsonPath('result.type', 'check_out')
        ->assertJsonPath('result.method', 'qr');

    $day = AttendanceDay::query()->sole();

    expect($day->check_out_at)->not->toBeNull()
        ->and($day->work_minutes)->toBe(493)
        ->and(AttendanceLog::query()->count())->toBe(2)
        ->and(QrToken::query()->count())->toBe(2);
});

test('QR check-in still requires the data consent', function () {
    $user = F::employee(consent: false);

    F::scanQr($user, displayedCode($this->kiosk))->assertUnprocessable()->assertJsonPath('reason', 'consent_required');
});

test('the payload is required', function () {
    F::scanQr(F::employee(), '')->assertUnprocessable()->assertJsonValidationErrors(['payload' => 'Kode QR belum terbaca']);
});

test('QR endpoints keep the check-in rate limiter', function (string $name) {
    expect(Route::getRoutes()->getByName($name)?->gatherMiddleware())->toContain('throttle:check-in');
})->with(['attendance.check-in.qr', 'attendance.check-out.qr', 'attendance.check-in', 'attendance.check-out']);

test('the same window issued by two kiosks at one location is stored once', function () {
    $second = Kiosk::factory()->at($this->office)->paired()->create();

    $first = $this->codes->issue($this->kiosk, now());
    $again = $this->codes->issue($second, now());

    expect($again->payload)->toBe($first->payload)
        ->and(QrToken::query()->count())->toBe(1)
        ->and(QrToken::query()->sole()->kiosk_id)->toBe($this->kiosk->id);
});
