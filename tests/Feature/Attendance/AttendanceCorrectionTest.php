<?php

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Event::fake([AttendanceRecorded::class]);
    $this->travelTo(F::at('2026-10-05 09:15'));
    F::office();
    $this->hr = User::factory()->withRole(Role::Hr)->create();
    $this->employee = F::employee();
});

function correct(User $actor, array $fields): TestResponse
{
    return test()->actingAs($actor)->from(route('attendance.board'))->post(route('attendance.corrections.store'), $fields);
}

test('HR fills a forgotten check-out: manual log, recomputed day, audit', function () {
    $day = AttendanceDay::factory()->for($this->employee)->on('2026-10-02')->status(S::NeedsCorrection)->create([
        'check_in_at' => F::at('2026-10-02 07:55')->utc(),
        'scheduled_start' => F::at('2026-10-02 08:00')->utc(),
        'scheduled_end' => F::at('2026-10-02 17:00')->utc(),
        'shift_id' => ShiftAssignment::query()->where('user_id', $this->employee->id)->value('shift_id'),
    ]);

    correct($this->hr, ['user_id' => $this->employee->id, 'work_date' => '2026-10-02', 'check_out' => '17:05', 'reason' => 'Lupa check-out, dikonfirmasi atasan'])
        ->assertRedirect(route('attendance.board'))
        ->assertSessionHasNoErrors();

    $day->refresh();
    $log = AttendanceLog::query()->sole();

    expect($day->status)->toBe(S::Present)
        ->and($day->check_out_at?->equalTo(F::at('2026-10-02 17:05')))->toBeTrue()
        ->and($day->check_out_log_id)->toBe($log->id)
        ->and($day->work_minutes)->toBe(490)
        ->and($log->method)->toBe(AttendanceMethod::Manual)
        ->and($log->type)->toBe(AttendanceLogType::CheckOut)
        ->and($log->corrected_by)->toBe($this->hr->id)
        ->and($log->note)->toBe('Lupa check-out, dikonfirmasi atasan');

    $audit = AuditLog::query()->where('action', 'attendance.corrected')->sole();
    expect($audit->user_id)->toBe($this->hr->id)
        ->and($audit->auditable_id)->toBe($day->id)
        ->and($audit->old_values)->toMatchArray(['status' => 'needs_correction', 'check_out_at' => null])
        ->and($audit->new_values)->toMatchArray(['status' => 'present', 'reason' => 'Lupa check-out, dikonfirmasi atasan']);

    Event::assertDispatched(AttendanceRecorded::class);
});

test('HR turns an alpha into a late day with both times', function () {
    AttendanceDay::factory()->for($this->employee)->on('2026-10-01')->status(S::Absent)->create();

    correct($this->hr, ['user_id' => $this->employee->id, 'work_date' => '2026-10-01', 'check_in' => '08:25', 'check_out' => '16:30', 'reason' => 'Mesin absen bermasalah'])
        ->assertSessionHasNoErrors();

    $day = AttendanceDay::query()->sole();

    expect($day->status)->toBe(S::Late)
        ->and($day->late_minutes)->toBe(15)
        ->and($day->early_leave_minutes)->toBe(30)
        ->and($day->work_minutes)->toBe(425)
        ->and(AttendanceLog::query()->where('method', 'manual')->count())->toBe(2);
});

test('a correction creates the day when nothing was recorded, and an overnight check-out rolls to the next day', function () {
    correct($this->hr, ['user_id' => $this->employee->id, 'work_date' => '2026-10-02', 'check_in' => '21:55', 'check_out' => '06:05', 'reason' => 'Tukar shift malam'])
        ->assertSessionHasNoErrors();

    $day = AttendanceDay::query()->sole();

    expect($day->work_date->toDateString())->toBe('2026-10-02')
        ->and($day->check_out_at?->equalTo(F::at('2026-10-03 06:05')))->toBeTrue()
        ->and($day->scheduled_start?->equalTo(F::at('2026-10-02 08:00')))->toBeTrue();
});

test('night shift: times before the check-in window opens belong to the morning after the work date', function () {
    $night = F::employee(shift: Shift::factory()->night()->create());

    // Shift 22.00–06.00 of Fri 2 Oct; the check-in window opens at 20.00, so 00.20 and 06.00 are on Sat 3 Oct.
    correct($this->hr, ['user_id' => $night->id, 'work_date' => '2026-10-02', 'check_in' => '00:20', 'check_out' => '06:00', 'reason' => 'Mesin absensi mati'])
        ->assertSessionHasNoErrors();

    $day = AttendanceDay::query()->where('user_id', $night->id)->sole();
    expect($day->work_date->toDateString())->toBe('2026-10-02')
        ->and($day->check_in_at?->equalTo(F::at('2026-10-03 00:20')))->toBeTrue()
        ->and($day->check_out_at?->equalTo(F::at('2026-10-03 06:00')))->toBeTrue()
        ->and($day->late_minutes)->toBeGreaterThan(0)
        ->and(AttendanceLog::query()->where('user_id', $night->id)->orderBy('occurred_at')->pluck('occurred_at')->map->toIso8601String()->all())
        ->toBe([F::at('2026-10-03 00:20')->utc()->toIso8601String(), F::at('2026-10-03 06:00')->utc()->toIso8601String()]);

    // A check-in inside the window stays on the work date.
    correct($this->hr, ['user_id' => $night->id, 'work_date' => '2026-10-02', 'check_in' => '21:50', 'reason' => 'Jam masuk sebenarnya'])
        ->assertSessionHasNoErrors();
    expect($day->refresh()->check_in_at?->equalTo(F::at('2026-10-02 21:50')))->toBeTrue()
        ->and($day->check_out_at?->equalTo(F::at('2026-10-03 06:00')))->toBeTrue()
        ->and($day->late_minutes)->toBe(0);
});

test('a check-in alone on a past day still needs correction', function () {
    correct($this->hr, ['user_id' => $this->employee->id, 'work_date' => '2026-10-02', 'check_in' => '07:58', 'reason' => 'Check-in gagal terkirim'])
        ->assertSessionHasNoErrors();

    expect(AttendanceDay::query()->sole()->status)->toBe(S::NeedsCorrection);
});

test('the reason is mandatory and times are validated', function (array $fields, string $field) {
    correct($this->hr, ['user_id' => $this->employee->id, 'work_date' => '2026-10-02', ...$fields])->assertSessionHasErrors($field);

    expect(AttendanceLog::query()->count())->toBe(0)->and(AuditLog::query()->where('action', 'attendance.corrected')->count())->toBe(0);
})->with([
    'no reason' => [['check_in' => '08:00'], 'reason'],
    'short reason' => [['check_in' => '08:00', 'reason' => 'ok'], 'reason'],
    'no time' => [['reason' => 'Lupa absen'], 'check_in'],
    'bad time' => [['check_in' => '8 pagi', 'reason' => 'Lupa absen'], 'check_in'],
    'check-out without check-in' => [['check_out' => '17:00', 'reason' => 'Lupa absen'], 'check_in'],
    'future date' => [['work_date' => '2026-10-06', 'check_in' => '08:00', 'reason' => 'Lupa absen'], 'work_date'],
    'future time today' => [['work_date' => '2026-10-05', 'check_in' => '10:00', 'reason' => 'Lupa absen'], 'check_in'],
]);

test('days from an approved request are not corrected here', function () {
    AttendanceDay::factory()->for($this->employee)->on('2026-10-02')->status(S::Leave)->create();

    correct($this->hr, ['user_id' => $this->employee->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'reason' => 'Ternyata masuk'])
        ->assertSessionHasErrors(['work_date' => 'Tanggal ini tercatat Cuti dari pengajuan yang disetujui. Ubah lewat pengajuan.']);
});

test('only HR and Super Admin of the same company may correct, never their own attendance', function (Role $role, bool $allowed) {
    $actor = User::factory()->withRole($role)->create();
    $response = correct($actor, ['user_id' => $this->employee->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'reason' => 'Lupa check-in']);

    $allowed ? $response->assertSessionHasNoErrors()->assertRedirect() : $response->assertForbidden();
})->with([
    [Role::SuperAdmin, true],
    [Role::Hr, true],
    [Role::Direksi, false],
    [Role::KepalaDivisi, false],
    [Role::Anggota, false],
]);

test('HR cannot correct their own attendance or another company', function () {
    correct($this->hr, ['user_id' => $this->hr->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'reason' => 'Lupa check-in'])->assertForbidden();

    $foreign = User::factory()->forCompany(Company::factory()->create())->create();
    correct($this->hr, ['user_id' => $foreign->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'reason' => 'Lupa check-in'])->assertForbidden();
});
