<?php

use App\Domain\Attendance\Actions\PruneQrTokens;
use App\Domain\Attendance\Jobs\PurgeExpiredSelfiesJob;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\QrToken;
use App\Domain\Attendance\Services\QrCodeService;
use App\Models\AuditLog;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    Storage::fake('selfies');
    config(['attendance.selfie.retention_months' => 12]);
    $this->travelTo(F::at('2026-10-05 02:30'));
});

function logWithSelfie(string $occurredAt, string $path): AttendanceLog
{
    Storage::disk('selfies')->put($path, 'jpeg');

    return AttendanceLog::factory()->forDay(AttendanceDay::factory()->create())->create([
        'occurred_at' => F::at($occurredAt)->utc(),
        'selfie_path' => $path,
    ]);
}

test('the monthly job deletes selfies older than the retention and keeps the logs', function () {
    $old = logWithSelfie('2025-10-04 08:00', '2025/10/a/old.jpg');
    $recent = logWithSelfie('2025-10-06 08:00', '2025/10/a/recent.jpg');

    dispatch_sync(new PurgeExpiredSelfiesJob);

    Storage::disk('selfies')->assertMissing('2025/10/a/old.jpg');
    Storage::disk('selfies')->assertExists('2025/10/a/recent.jpg');

    expect($old->fresh()?->selfie_path)->toBeNull()
        ->and($recent->fresh()?->selfie_path)->toBe('2025/10/a/recent.jpg')
        ->and(AttendanceLog::query()->count())->toBe(2)
        ->and(AuditLog::query()->where('action', 'selfie.purged')->sole()->new_values)->toMatchArray(['count' => 1, 'retention_months' => 12]);

    // Idempotent.
    $this->artisan('attendance:purge-selfies')->expectsOutput('0 selfie dihapus (retensi 12 bulan).')->assertSuccessful();
});

test('the retention follows ATTENDANCE_SELFIE_RETENTION_MONTHS', function () {
    config(['attendance.selfie.retention_months' => 3]);
    logWithSelfie('2026-07-01 08:00', '2026/07/a/x.jpg');

    $this->artisan('attendance:purge-selfies')->expectsOutput('1 selfie dihapus (retensi 3 bulan).')->assertSuccessful();
});

test('apart from the selfie path the log stays immutable', function () {
    $log = logWithSelfie('2025-01-01 08:00', 'a.jpg');

    $log->selfie_path = 'b.jpg';
    expect(fn () => $log->save())->toThrow(LogicException::class);
});

test('the jobs are scheduled', function () {
    $events = collect(app(Schedule::class)->events());

    expect($events->contains(fn ($event) => str_contains((string) $event->description, 'PurgeExpiredSelfiesJob') && $event->expression === '30 2 1 * *'))->toBeTrue()
        ->and($events->contains(fn ($event) => str_contains((string) $event->command, 'attendance:prune-qr-tokens')))->toBeTrue();
});

test('unscanned QR codes are pruned, scanned ones are kept', function () {
    $kiosk = Kiosk::factory()->at(F::office())->create();
    $codes = app(QrCodeService::class);
    $codes->issue($kiosk, now()->subDays(5));
    $codes->issue($kiosk, now()->subDays(5)->addMinute());
    $codes->issue($kiosk, now()->subHour());

    $used = QrToken::query()->orderBy('valid_from')->first();
    AttendanceLog::factory()->forDay(AttendanceDay::factory()->create())->create(['qr_token_id' => $used?->id, 'method' => 'qr']);

    expect(app(PruneQrTokens::class)->handle(now()))->toBe(1)
        ->and(QrToken::query()->count())->toBe(2);
});
