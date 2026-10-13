<?php

use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AttendanceFixtures as F;

/*
| API v1 — B5-B Absensi tim (Bagian 5): hari ini, perlu ditinjau + selfie
| bertanda tangan (diaudit), koreksi manual, rekap bulanan per karyawan.
| Data, Action dan Policy web (TodayBoard, MarkLogReviewed, CorrectAttendance,
| MonthlyRecap/RecapPresenter, AttendanceDayPolicy, AttendanceLogPolicy).
| Senin 5 Okt 2026 09.15 WIB.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->travelTo(F::at('2026-10-05 09:15'));
    $this->office = F::office();
    $this->ops = Division::factory()->create(['name' => 'Operasional']);
    $this->finance = Division::factory()->create(['name' => 'Keuangan']);
    $this->hr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hana HR']);
    $this->direksi = User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Direksi']);
    $this->kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($this->ops)->create(['name' => 'Dimas Kadiv']);
    $this->ops->update(['head_user_id' => $this->kadiv->id]);
    $this->lead = User::factory()->withRole(Role::Anggota)->inDivision($this->ops)->create(['name' => 'Lukas Atasan']);

    $make = function (string $name, Division $division, ?S $status = null, array $extra = []): User {
        $user = F::employee(shift: Shift::factory()->create(['office_location_id' => $this->office->id]));
        $user->update(['name' => $name, 'division_id' => $division->id]);

        if ($status !== null) {
            AttendanceDay::factory()->for($user)->on('2026-10-05')->status($status)->create($extra);
        }

        return $user;
    };

    $this->sari = $make('Sari Wulandari', $this->ops, S::Present, ['check_in_at' => F::at('2026-10-05 07:52')->utc()]);
    $this->bayu = $make('Bayu Saputra', $this->ops, S::Late, ['check_in_at' => F::at('2026-10-05 08:20')->utc(), 'late_minutes' => 10]);
    $this->bayu->update(['manager_id' => $this->lead->id]);
    $this->fitri = $make('Fitri Handayani', $this->finance);
});

function flaggedLogOf(User $user, bool $withSelfie = true): AttendanceLog
{
    $day = AttendanceDay::query()->where('user_id', $user->id)->whereDate('work_date', '2026-10-05')->sole();
    $path = '2026/10/'.$user->id.'/selfie.jpg';

    if ($withSelfie) {
        Storage::disk('selfies')->put($path, 'jpeg-bytes');
    }

    return AttendanceLog::factory()->forDay($day)->create([
        'flags' => [LogFlag::NewDevice, LogFlag::ClockSkew],
        'is_suspicious' => true,
        'selfie_path' => $withSelfie ? $path : null,
        'office_location_id' => test()->office->id,
    ]);
}

// --- Hari ini ---

test('HR gets the company board with flagged logs, missing check-outs and polling hint', function () {
    flaggedLogOf($this->bayu);
    AttendanceDay::factory()->for($this->sari)->on('2026-10-04')->status(S::NeedsCorrection)->create(['check_in_at' => F::at('2026-10-04 05:57')->utc()]);
    Sanctum::actingAs($this->hr);

    $this->getJson('/api/v1/absensi/tim/hari-ini')
        ->assertOk()
        ->assertJsonPath('board.date', '2026-10-05')
        ->assertJsonPath('board.summary.scheduled', 3)
        ->assertJsonPath('board.summary.present', 2)
        ->assertJsonPath('board.summary.late', 1)
        ->assertJsonPath('board.summary.notCheckedIn', 1)
        ->assertJsonPath('board.divisions', [
            ['id' => $this->finance->id, 'name' => 'Keuangan', 'scheduled' => 1, 'onTime' => 0, 'late' => 0, 'onLeave' => 0, 'notCheckedIn' => 1],
            ['id' => $this->ops->id, 'name' => 'Operasional', 'scheduled' => 2, 'onTime' => 1, 'late' => 1, 'onLeave' => 0, 'notCheckedIn' => 0],
        ])
        ->assertJsonPath('suspicious.total', 1)
        ->assertJsonPath('suspicious.items.0.name', 'Bayu Saputra')
        ->assertJsonPath('suspicious.items.0.canViewSelfie', true)
        ->assertJsonPath('suspicious.items.0.canReview', true)
        ->assertJsonPath('missing_check_out.0.name', 'Sari Wulandari')
        ->assertJsonPath('can.correct', true)
        ->assertJsonPath('poll_seconds', 60)
        ->assertJsonPath('locations.0.id', $this->office->id);
});

test('Direksi reads the whole board, a Kepala Divisi only the own division, staff get 403', function () {
    Sanctum::actingAs($this->direksi);
    $this->getJson('/api/v1/absensi/tim/hari-ini')->assertOk()->assertJsonPath('board.summary.scheduled', 3)->assertJsonPath('can.correct', false);

    Sanctum::actingAs($this->kadiv);
    $this->getJson('/api/v1/absensi/tim/hari-ini')->assertOk()
        ->assertJsonPath('board.summary.scheduled', 2)
        ->assertJsonCount(2, 'board.people')
        ->assertJsonPath('can.correct', false)
        ->assertJsonPath('can.review', false);

    Sanctum::actingAs($this->sari);
    $this->getJson('/api/v1/absensi/tim/hari-ini')->assertForbidden();
    $this->getJson('/api/v1/absensi/tim/perlu-ditinjau')->assertForbidden();
    $this->getJson('/api/v1/absensi/tim/rekap')->assertForbidden();
});

// --- Perlu ditinjau & selfie ---

test('the review list is paginated and HR marks a log reviewed once (audited)', function () {
    $log = flaggedLogOf($this->bayu);
    flaggedLogOf($this->sari, withSelfie: false);
    Sanctum::actingAs($this->hr);

    $this->getJson('/api/v1/absensi/tim/perlu-ditinjau')
        ->assertOk()
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('meta.per_page', 20)
        ->assertJsonCount(2, 'items');

    $this->postJson("/api/v1/absensi/log/{$log->id}/tinjau")
        ->assertOk()
        ->assertJsonPath('message', 'Log Bayu Saputra ditandai sudah ditinjau.')
        ->assertJsonPath('log.reviewed_by.name', 'Hana HR');

    expect($log->refresh()->reviewed_by)->toBe($this->hr->id)
        ->and(AuditLog::query()->where('action', 'attendance.log_reviewed')->count())->toBe(1);

    // Idempotent: the first review stays, no second audit row.
    $this->postJson("/api/v1/absensi/log/{$log->id}/tinjau")->assertOk();
    expect(AuditLog::query()->where('action', 'attendance.log_reviewed')->count())->toBe(1);
    $this->getJson('/api/v1/absensi/tim/perlu-ditinjau')->assertJsonPath('meta.total', 1);
});

test('a Kepala Divisi sees the flagged logs of the division but cannot review them nor see the selfie', function () {
    $log = flaggedLogOf($this->bayu);
    Sanctum::actingAs($this->kadiv);

    $this->getJson('/api/v1/absensi/tim/perlu-ditinjau')
        ->assertOk()
        ->assertJsonPath('items.0.canViewSelfie', false)
        ->assertJsonPath('items.0.canReview', false);
    $this->postJson("/api/v1/absensi/log/{$log->id}/tinjau")->assertForbidden();
    $this->getJson("/api/v1/absensi/log/{$log->id}/selfie-url")->assertForbidden();
    expect($log->refresh()->reviewed_at)->toBeNull();
});

test('HR gets a five-minute signed selfie link; the image fetch needs it and is audited', function () {
    $log = flaggedLogOf($this->bayu);
    Sanctum::actingAs($this->hr);

    $response = $this->getJson("/api/v1/absensi/log/{$log->id}/selfie-url")
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('expires_at', now()->addMinutes(5)->toIso8601String());
    $url = (string) $response->json('url');

    expect($url)->toContain('/api/v1/absensi/log/'.$log->id.'/selfie')->toContain('signature=')
        ->and(AuditLog::query()->where('action', 'selfie.viewed')->count())->toBe(0);

    $this->get($url)->assertOk()->assertHeader('Cache-Control', 'max-age=0, no-store, private');

    $audit = AuditLog::query()->where('action', 'selfie.viewed')->sole();
    expect($audit->user_id)->toBe($this->hr->id)
        ->and($audit->auditable_id)->toBe($log->id)
        ->and($audit->new_values)->toMatchArray(['employee_id' => $this->bayu->id, 'own' => false]);

    // Unsigned or tampered links are refused; links expire.
    $this->get("/api/v1/absensi/log/{$log->id}/selfie")->assertForbidden();
    $this->get($url.'x')->assertForbidden();
    $this->travel(6)->minutes();
    $this->get($url)->assertForbidden();
    expect(AuditLog::query()->where('action', 'selfie.viewed')->count())->toBe(1);
});

test('the direct manager may see the selfie; another employee may not, even with a signed link', function () {
    $log = flaggedLogOf($this->bayu);

    Sanctum::actingAs($this->lead);
    $url = (string) $this->getJson("/api/v1/absensi/log/{$log->id}/selfie-url")->assertOk()->json('url');
    $this->get($url)->assertOk();

    Sanctum::actingAs($this->sari);
    $this->getJson("/api/v1/absensi/log/{$log->id}/selfie-url")->assertForbidden();
    $this->get($url)->assertForbidden();

    expect(AuditLog::query()->where('action', 'selfie.viewed')->pluck('user_id')->all())->toBe([$this->lead->id]);
});

test('a selfie removed by retention is a 404 with the web message', function () {
    $log = flaggedLogOf($this->bayu, withSelfie: false);
    Sanctum::actingAs($this->hr);

    $this->getJson("/api/v1/absensi/log/{$log->id}/selfie-url")
        ->assertNotFound()
        ->assertJsonPath('message', 'Selfie sudah dihapus sesuai masa retensi.');
});

// --- Koreksi manual ---

test('HR corrects a day: manual log, audit, day returned', function () {
    Sanctum::actingAs($this->hr);

    $this->postJson('/api/v1/absensi/koreksi', [
        'user_id' => $this->fitri->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'check_out' => '17:05', 'reason' => 'Mesin absensi mati, dikonfirmasi atasan',
    ])
        ->assertOk()
        ->assertJsonPath('message', 'Absensi Fitri Handayani dikoreksi.')
        ->assertJsonPath('day.workDate', '2026-10-02')
        ->assertJsonPath('day.status', 'present')
        ->assertJsonPath('day.checkIn.method', 'manual');

    $log = AttendanceLog::query()->where('user_id', $this->fitri->id)->where('type', 'check_out')->sole();
    expect($log->method)->toBe(AttendanceMethod::Manual)
        ->and($log->corrected_by)->toBe($this->hr->id)
        ->and(AuditLog::query()->where('action', 'attendance.corrected')->sole()->user_id)->toBe($this->hr->id);
});

test('corrections need a reason and a time, and are HR-only (never oneself)', function () {
    Sanctum::actingAs($this->hr);
    $this->postJson('/api/v1/absensi/koreksi', ['user_id' => $this->fitri->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'reason' => ''])
        ->assertUnprocessable()
        ->assertJsonPath('errors.reason.0', 'Alasan koreksi wajib diisi.');
    $this->postJson('/api/v1/absensi/koreksi', ['user_id' => $this->fitri->id, 'work_date' => '2026-10-02', 'reason' => 'Lupa absen pagi'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.check_in.0', 'Isi jam masuk, jam pulang, atau keduanya.');
    $this->postJson('/api/v1/absensi/koreksi', ['user_id' => $this->hr->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'reason' => 'Koreksi diri sendiri'])
        ->assertForbidden();

    foreach ([$this->kadiv, $this->direksi] as $actor) {
        Sanctum::actingAs($actor);
        $this->postJson('/api/v1/absensi/koreksi', ['user_id' => $this->bayu->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'reason' => 'Lupa absen pagi'])
            ->assertForbidden();
    }

    expect(AttendanceLog::query()->where('method', 'manual')->exists())->toBeFalse();
});

// --- Rekap bulanan ---

test('HR gets the monthly recap per employee and one employee month with calendar and logs', function () {
    $day = AttendanceDay::factory()->for($this->sari)->on('2026-09-02')->status(S::Late)->create([
        'check_in_at' => F::at('2026-09-02 08:21')->utc(), 'late_minutes' => 11,
    ]);
    AttendanceLog::factory()->forDay($day)->create(['occurred_at' => F::at('2026-09-02 08:21')->utc()]);
    Sanctum::actingAs($this->hr);

    $this->getJson('/api/v1/absensi/tim/rekap?bulan=2026-09&divisi='.$this->ops->id)
        ->assertOk()
        ->assertJsonPath('period.month', '2026-09')
        ->assertJsonPath('period.label', 'September 2026')
        ->assertJsonPath('filters.divisi', $this->ops->id)
        ->assertJsonPath('can.export', true)
        ->assertJsonPath('can.correct', true)
        ->assertJsonPath('web_path', '/absensi/rekap');

    $this->getJson('/api/v1/absensi/tim/rekap?bulan=2026-09&q=sari')
        ->assertOk()
        ->assertJsonPath('report.summary.employees', 1)
        ->assertJsonPath('report.rows.0.name', 'Sari Wulandari')
        ->assertJsonPath('report.rows.0.lateCount', 1)
        ->assertJsonPath('report.rows.0.lateMinutes', 11);

    $detail = $this->getJson("/api/v1/absensi/tim/rekap/{$this->sari->id}?bulan=2026-09")
        ->assertOk()
        ->assertJsonPath('detail.userId', $this->sari->id)
        ->assertJsonPath('detail.days.1.date', '2026-09-02')
        ->assertJsonPath('detail.days.1.kind', 'late')
        ->assertJsonPath('can.correct', true)
        ->assertJsonCount(1, 'detail.logs');

    expect($detail->json('detail.days'))->toHaveCount(30)
        ->and($detail->json('detail.logs.0.selfieUrl'))->toBeNull();
});

test('a Kepala Divisi reads the own division recap only; others are 404', function () {
    Sanctum::actingAs($this->kadiv);

    $rows = collect($this->getJson('/api/v1/absensi/tim/rekap')->assertOk()->assertJsonPath('can.export', false)->json('report.rows'))->pluck('name');
    expect($rows)->toContain('Sari Wulandari')->not->toContain('Fitri Handayani');

    $this->getJson("/api/v1/absensi/tim/rekap/{$this->sari->id}")->assertOk()->assertJsonPath('can.correct', false);
    $this->getJson("/api/v1/absensi/tim/rekap/{$this->fitri->id}")->assertNotFound();
});
