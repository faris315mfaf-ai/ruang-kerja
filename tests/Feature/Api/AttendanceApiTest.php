<?php

use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Jobs\CreateWorkPlanTasksForDay;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Tasks\Actions\CreateWorkPlanTasks;
use App\Domain\Tasks\Enums\TaskSource;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpFoundation\Response;
use Tests\Support\AttendanceFixtures as F;

/*
| API v1 — own attendance of the mobile app: today's state (MyAttendance
| presenter), check-in/out with the web Action and rejection bodies
| ({message, reason, context} 422), and the monthly history. Every call runs
| with the user's Sanctum device token (POST /api/v1/auth/login).
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', 'abababababababababababababababababababababababababababababababab');
} // 64 hex (SHA-256)

/**
 * Signs the employee in through the real endpoint and returns the token.
 */
function tokenAbsensi(User $user): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * POST a (multipart) check-in or check-out as the device token, ~33 m from
 * the office, like Tests\Support\AttendanceFixtures::checkIn.
 *
 * @param  array<string, mixed>  $fields
 * @return TestResponse<Response>
 */
function checkAbsensi(string $token, array $fields = [], string $type = 'in'): TestResponse
{
    return test()->withToken($token)
        ->withHeader('Accept', 'application/json')
        ->post("/api/v1/absensi/check-{$type}", [
            'latitude' => F::OFFICE_LAT + 0.0003,
            'longitude' => F::OFFICE_LNG,
            'accuracy' => 12,
            'client_time' => now()->toIso8601String(),
            'selfie' => F::selfie(),
            'device_id' => HASH_PONSEL,
            // Laporan kerja is required at check-out (13 Okt 2026).
            ...($type === 'in' ? [] : ['work_report' => ['Menyelesaikan laporan mingguan']]),
            ...$fields,
        ]);
}

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->office = F::office();
});

test('hari-ini returns the own day state with schedule, locations and work mode', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:00'));
    $token = tokenAbsensi($user);

    $this->withToken($token)->getJson('/api/v1/absensi/hari-ini')
        ->assertOk()
        ->assertJsonPath('today.action', 'check_in')
        ->assertJsonPath('today.schedule.workDate', '2026-10-05')
        ->assertJsonPath('today.schedule.isWorkday', true)
        ->assertJsonPath('today.schedule.shiftName', 'Reguler')
        ->assertJsonPath('today.schedule.start', '2026-10-05T01:00:00Z')
        ->assertJsonPath('today.schedule.end', '2026-10-05T10:00:00Z')
        ->assertJsonPath('today.schedule.workMode', 'office')
        ->assertJsonPath('today.schedule.allowsRemote', false)
        ->assertJsonPath('today.day', null)
        ->assertJsonCount(1, 'today.locations')
        ->assertJsonPath('today.locations.0.name', 'Kantor Pusat')
        ->assertJsonPath('today.locations.0.latitude', F::OFFICE_LAT)
        ->assertJsonPath('today.locations.0.longitude', F::OFFICE_LNG)
        ->assertJsonPath('today.locations.0.radiusM', 100)
        ->assertJsonStructure(['serverTime']);
});

test('check-in succeeds with a selfie and turns a two-point work plan into two tasks', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    $token = tokenAbsensi($user);

    checkAbsensi($token, ['work_plan' => ['Selesaikan laporan mingguan', 'Meeting klien 14.00']])
        ->assertCreated()
        ->assertJsonPath('result.type', 'check_in')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.statusLabel', 'Hadir')
        ->assertJsonPath('result.method', 'gps_selfie')
        ->assertJsonPath('result.workDate', '2026-10-05')
        ->assertJsonPath('result.location.name', 'Kantor Pusat')
        ->assertJsonPath('result.location.inside', true);

    $day = AttendanceDay::query()->sole();

    expect($day->work_plan)->toBe(['Selesaikan laporan mingguan', 'Meeting klien 14.00'])
        ->and($day->checkInLog->method)->toBe(AttendanceMethod::GpsSelfie);

    // "Rencana kerja jadi tugas otomatis": one task per point in the own personal workspace.
    $personal = Workspace::query()
        ->where('type', WorkspaceType::Personal->value)
        ->where('owner_id', $user->id)
        ->firstOrFail();

    $tasks = Task::query()->where('workspace_id', $personal->id)->with('assignees')->orderBy('number')->get();

    expect($tasks)->toHaveCount(2)
        ->and($tasks[0]->title)->toBe('Selesaikan laporan mingguan')
        ->and($tasks[1]->title)->toBe('Meeting klien 14.00')
        ->and($tasks->pluck('source')->unique()->values()->all())->toBe([TaskSource::Attendance]);

    // The next action is now check-out.
    $this->withToken($token)->getJson('/api/v1/absensi/hari-ini')
        ->assertOk()
        ->assertJsonPath('today.action', 'check_out')
        ->assertJsonPath('today.day.status', 'present')
        ->assertJsonPath('today.day.checkIn.method', 'gps_selfie');
});

test('check-out closes the day without a work plan field', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    $token = tokenAbsensi($user);

    checkAbsensi($token)->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:30'));
    checkAbsensi($token, type: 'out')
        ->assertCreated()
        ->assertJsonPath('result.type', 'check_out')
        ->assertJsonPath('result.workMinutes', 518); // 9j38m − 60m istirahat

    expect(AttendanceDay::query()->sole()->check_out_at)->not->toBeNull();
});

test('a geofence rejection mirrors the web body', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55'));
    $token = tokenAbsensi($user);

    checkAbsensi($token, ['latitude' => F::northOfOffice(340), 'accuracy' => 85])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Anda berada 340 m dari Kantor Pusat (batas 100 m). Ajukan dinas luar jika sedang bertugas di luar.')
        ->assertJsonPath('reason', 'outside_geofence')
        ->assertJsonPath('context.distance_m', 340)
        ->assertJsonPath('context.radius_m', 100)
        ->assertJsonPath('context.accuracy_m', 85)
        ->assertJsonPath('context.location.name', 'Kantor Pusat');

    expect(AttendanceDay::query()->count())->toBe(0)
        ->and(Storage::disk('selfies')->allFiles())->toBeEmpty();
});

test('a note_required rejection answers the same body as the web, then accepts a note', function () {
    $user = F::employee(WorkMode::Wfh);
    $this->travelTo(F::at('2026-10-05 07:58'));
    $token = tokenAbsensi($user);

    $far = ['latitude' => F::northOfOffice(25_000)];

    checkAbsensi($token, $far)
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'note_required')
        ->assertJsonPath('message', 'Tulis catatan lokasi atau aktivitas untuk check-in di luar kantor (WFH/lapangan).');

    checkAbsensi($token, [...$far, 'note' => 'Rumah, menyusun laporan'])
        ->assertCreated()
        ->assertJsonPath('result.method', 'wfh')
        ->assertJsonPath('result.status', 'wfh')
        ->assertJsonPath('result.location.inside', false);
});

test('validation fails with the same Indonesian messages as the web', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    $token = tokenAbsensi($user);

    checkAbsensi($token, ['latitude' => null, 'longitude' => null, 'selfie' => null])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['latitude', 'longitude', 'selfie'])
        ->assertJsonPath('errors.selfie.0', 'Ambil selfie terlebih dulu.')
        ->assertJsonPath('errors.latitude.0', 'Lokasi belum terbaca. Izinkan akses lokasi lalu coba lagi.');

    checkAbsensi($token, ['work_plan' => array_fill(0, 9, 'poin')])
        ->assertUnprocessable()
        ->assertJsonPath('errors.work_plan.0', 'Maksimal 8 poin rencana kerja.');

    // The app always sends the SHA-256 hash; anything else is refused.
    checkAbsensi($token, ['device_id' => 'device-1'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.device_id.0', 'Identitas perangkat tidak valid.');
});

test('riwayat returns the days of the requested month of the token owner', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    $token = tokenAbsensi($user);

    checkAbsensi($token)->assertCreated();

    $this->withToken($token)->getJson('/api/v1/absensi/riwayat?bulan=2026-10')
        ->assertOk()
        ->assertJsonPath('period.month', '2026-10')
        ->assertJsonPath('period.label', 'Oktober 2026')
        ->assertJsonPath('recap.userId', $user->id)
        ->assertJsonCount(31, 'recap.days')
        ->assertJsonPath('recap.days.4.date', '2026-10-05')
        ->assertJsonPath('recap.days.4.checkIn.method', 'gps_selfie')
        ->assertJsonPath('recap.days.0.checkIn', null);

    // An invalid month falls back to the running month, like the web.
    $this->withToken($token)->getJson('/api/v1/absensi/riwayat?bulan=bukan-bulan')
        ->assertOk()
        ->assertJsonPath('period.month', '2026-10');
});

test('attendance endpoints reject requests without a token', function () {
    $this->getJson('/api/v1/absensi/hari-ini')->assertUnauthorized();
    $this->getJson('/api/v1/absensi/riwayat')->assertUnauthorized();
    $this->post('/api/v1/absensi/check-in', [])->assertUnauthorized();
    $this->post('/api/v1/absensi/check-out', [])->assertUnauthorized();
});

test('the work-plan tasks are created after the check-in commits, never inside it', function () {
    Queue::fake([CreateWorkPlanTasksForDay::class]);
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    $token = tokenAbsensi($user);

    checkAbsensi($token, ['work_plan' => ['Selesaikan laporan mingguan']])->assertCreated();

    // The check-in stands on its own; the task chain runs as a separate job.
    $day = AttendanceDay::query()->sole();
    expect($day->check_in_at)->not->toBeNull()
        ->and(Task::query()->count())->toBe(0);

    Queue::assertPushed(CreateWorkPlanTasksForDay::class, fn (CreateWorkPlanTasksForDay $job): bool => $job->attendanceDayId === $day->id);
});

test('the work-plan job is idempotent per day', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    checkAbsensi(tokenAbsensi($user), ['work_plan' => ['Satu', 'Dua']])->assertCreated();
    $day = AttendanceDay::query()->sole();

    (new CreateWorkPlanTasksForDay($day->id))->handle(app(CreateWorkPlanTasks::class));

    expect(Task::query()->where('source_id', $day->id)->count())->toBe(2);
});

test('the check-in fingerprint is the device registered with the token, not client input', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    $token = tokenAbsensi($user);

    checkAbsensi($token, ['device_id' => str_repeat('ef', 32)])->assertCreated();

    expect(AttendanceDay::query()->sole()->checkInLog->device_fingerprint)->toBe(HASH_PONSEL);
});
