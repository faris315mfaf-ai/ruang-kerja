<?php

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Organization\Enums\Role;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Support\AttendanceFixtures as F;

/*
 * Absen pegawai (keputusan pemilik 20 Okt 2026): HR sets a day's status by
 * hand (SetAttendanceStatus) or removes a day (ClearAttendanceDay).
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Event::fake([AttendanceRecorded::class]);
    Notification::fake();
    $this->travelTo(F::at('2026-10-05 09:15'));
    F::office();
    $this->hr = User::factory()->withRole(Role::Hr)->create();
    $this->employee = F::employee();
});

/**
 * @param  array<string, mixed>  $fields
 */
function setStatus(User $actor, User $employee, string $date, array $fields): TestResponse
{
    return test()->actingAs($actor)->from(route('attendance.employees.index'))
        ->put(route('attendance.employees.update', ['employee' => $employee->id, 'date' => $date]), ['reason' => 'Dikonfirmasi atasan langsung', ...$fields]);
}

function clearDay(User $actor, User $employee, string $date, string $reason = 'Salah input kemarin'): TestResponse
{
    return test()->actingAs($actor)->from(route('attendance.employees.index'))
        ->delete(route('attendance.employees.destroy', ['employee' => $employee->id, 'date' => $date]), ['reason' => $reason]);
}

test('HR marks a past day without a row as sick: manual row, schedule snapshot, audit', function () {
    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'sick'])
        ->assertRedirect(route('attendance.employees.index'))
        ->assertSessionHasNoErrors();

    $day = AttendanceDay::query()->sole();

    expect($day->status)->toBe(S::Sick)
        ->and($day->isManual())->toBeTrue()
        ->and($day->status_set_by)->toBe($this->hr->id)
        ->and($day->status_set_at?->equalTo(now()))->toBeTrue()
        ->and($day->shift_id)->not->toBeNull()
        ->and($day->isFromRequest())->toBeFalse()
        ->and(AttendanceLog::query()->count())->toBe(0);

    $audit = AuditLog::query()->where('action', 'attendance.status_set')->sole();
    expect($audit->user_id)->toBe($this->hr->id)
        ->and($audit->auditable_id)->toBe($day->id)
        ->and($audit->old_values['status'])->toBeNull()
        ->and($audit->new_values['status'])->toBe('sick')
        ->and($audit->new_values['reason'])->toBe('Dikonfirmasi atasan langsung')
        ->and($audit->new_values['employee_id'])->toBe($this->employee->id);

    Event::assertNotDispatched(AttendanceRecorded::class);
});

test('present with times writes manual logs and wins over the computed late status', function () {
    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'present', 'check_in' => '08:40', 'check_out' => '17:00'])
        ->assertSessionHasNoErrors();

    $day = AttendanceDay::query()->sole();
    $logs = AttendanceLog::query()->orderBy('occurred_at')->get();

    expect($day->status)->toBe(S::Present)
        ->and($day->late_minutes)->toBe(0)
        ->and($day->early_leave_minutes)->toBe(0)
        ->and($day->work_minutes)->toBe(440)
        ->and($day->check_in_at?->equalTo(F::at('2026-10-02 08:40')))->toBeTrue()
        ->and($day->isManual())->toBeTrue()
        ->and($logs)->toHaveCount(2)
        ->and($logs->every(fn (AttendanceLog $log) => $log->method === AttendanceMethod::Manual && $log->corrected_by === $this->hr->id))->toBeTrue();

    Event::assertDispatched(AttendanceRecorded::class);
});

test('late keeps the computed late minutes', function () {
    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'late', 'check_in' => '08:40'])
        ->assertSessionHasNoErrors();

    $day = AttendanceDay::query()->sole();

    expect($day->status)->toBe(S::Late)
        ->and($day->late_minutes)->toBe(30);
});

test('a non-attended status keeps existing check-in data and zeroes late minutes', function () {
    $day = AttendanceDay::factory()->for($this->employee)->on('2026-10-02')->status(S::Late)->create([
        'check_in_at' => F::at('2026-10-02 08:30')->utc(),
        'late_minutes' => 20,
    ]);

    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'permit', 'check_in' => '08:00'])
        ->assertSessionHasNoErrors();

    $day->refresh();

    expect($day->status)->toBe(S::Permit)
        ->and($day->late_minutes)->toBe(0)
        ->and($day->check_in_at?->equalTo(F::at('2026-10-02 08:30')))->toBeTrue()
        ->and(AttendanceLog::query()->count())->toBe(0);
});

test('future dates accept planned absences only', function () {
    setStatus($this->hr, $this->employee, '2026-10-07', ['status' => 'present'])
        ->assertSessionHasErrors(['work_date' => 'Tanggal belum terjadi.']);
    setStatus($this->hr, $this->employee, '2026-10-07', ['status' => 'absent'])
        ->assertSessionHasErrors('work_date');

    setStatus($this->hr, $this->employee, '2026-10-07', ['status' => 'leave'])->assertSessionHasNoErrors();

    expect(AttendanceDay::query()->sole()->status)->toBe(S::Leave);
});

test('full-day request days are changed through the request', function () {
    AttendanceDay::factory()->for($this->employee)->on('2026-10-02')->status(S::Leave)->create(['request_portion' => RequestPortion::Full]);

    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'present'])
        ->assertSessionHasErrors(['work_date' => 'Tanggal ini tercatat Cuti dari pengajuan yang disetujui. Ubah lewat pengajuan.']);
});

test('statuses outside the manual list and bad input are rejected', function () {
    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'needs_correction'])->assertSessionHasErrors('status');
    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'present', 'check_in' => '8 pagi'])->assertSessionHasErrors('check_in');
    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'present', 'reason' => 'oke'])->assertSessionHasErrors('reason');

    test()->actingAs($this->hr)->put(route('attendance.employees.update', ['employee' => $this->employee->id, 'date' => '2026-02-31']), ['status' => 'present', 'reason' => 'Tanggal tidak ada'])
        ->assertNotFound();

    expect(AttendanceDay::query()->count())->toBe(0);
});

test('a locked payroll month refuses manual statuses, corrections and clearing', function () {
    $day = AttendanceDay::factory()->for($this->employee)->on('2026-10-01')->status(S::Absent)->create();
    PayrollPeriod::query()->create(['company_id' => $this->hr->company_id, 'month' => '2026-10-01', 'locked_at' => now(), 'locked_by' => $this->hr->id]);
    $message = 'Periode gaji Oktober 2026 sudah dikunci. Buka kunci di Absensi › Gaji dulu.';

    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'sick'])->assertSessionHasErrors(['work_date' => $message]);
    clearDay($this->hr, $this->employee, '2026-10-01')->assertSessionHasErrors(['work_date' => $message]);
    test()->actingAs($this->hr)->from(route('attendance.board'))->post(route('attendance.corrections.store'), [
        'user_id' => $this->employee->id, 'work_date' => '2026-10-02', 'check_in' => '08:00', 'reason' => 'Lupa check-in pagi',
    ])->assertSessionHasErrors(['work_date' => $message]);

    expect($day->fresh()?->status)->toBe(S::Absent)
        ->and(AttendanceDay::query()->count())->toBe(1);
});

test('HR clears a day without logs; audit keeps the old status', function () {
    $day = AttendanceDay::factory()->for($this->employee)->on('2026-10-02')->status(S::Absent)->create();

    clearDay($this->hr, $this->employee, '2026-10-02')->assertSessionHasNoErrors();

    expect(AttendanceDay::query()->count())->toBe(0);

    $audit = AuditLog::query()->where('action', 'attendance.day_cleared')->sole();
    expect($audit->auditable_id)->toBe($day->id)
        ->and($audit->old_values['status'])->toBe('absent')
        ->and($audit->new_values)->toMatchArray(['work_date' => '2026-10-02', 'reason' => 'Salah input kemarin', 'employee_id' => $this->employee->id]);
});

test('days with check-in logs, request days and missing days cannot be cleared', function () {
    setStatus($this->hr, $this->employee, '2026-10-01', ['status' => 'present', 'check_in' => '08:00', 'check_out' => '17:00'])->assertSessionHasNoErrors();
    AttendanceDay::factory()->for($this->employee)->on('2026-10-02')->status(S::Sick)->create(['request_portion' => RequestPortion::Full]);

    clearDay($this->hr, $this->employee, '2026-10-01')
        ->assertSessionHasErrors(['work_date' => 'Hari ini punya catatan check-in, jadi tidak bisa dihapus. Ubah statusnya saja.']);
    clearDay($this->hr, $this->employee, '2026-10-02')
        ->assertSessionHasErrors(['work_date' => 'Tanggal ini tercatat Sakit dari pengajuan yang disetujui. Ubah lewat pengajuan.']);
    clearDay($this->hr, $this->employee, '2026-09-30')
        ->assertSessionHasErrors(['work_date' => 'Tidak ada catatan absensi pada tanggal ini.']);
    clearDay($this->hr, $this->employee, '2026-10-02', 'ok')->assertSessionHasErrors('reason');

    expect(AttendanceDay::query()->count())->toBe(2);
});

test('closing the day never overwrites, removes or flags a manual row', function () {
    $close = app(CloseAttendanceDay::class);
    // Scheduled Friday: HR said Hadir without times.
    setStatus($this->hr, $this->employee, '2026-10-02', ['status' => 'present'])->assertSessionHasNoErrors();
    // Saturday (not scheduled): HR marked Alpha.
    setStatus($this->hr, $this->employee, '2026-10-03', ['status' => 'absent'])->assertSessionHasNoErrors();
    // Thursday: checked in by hand, no check-out.
    setStatus($this->hr, $this->employee, '2026-10-01', ['status' => 'wfh', 'check_in' => '08:00'])->assertSessionHasNoErrors();

    foreach (['2026-10-01', '2026-10-02', '2026-10-03'] as $date) {
        $close->handle(F::at($date));
    }

    $days = AttendanceDay::query()->orderBy('work_date')->get();

    expect($days->map(fn (AttendanceDay $day) => $day->status)->all())->toBe([S::Wfh, S::Present, S::Absent])
        ->and($days->every(fn (AttendanceDay $day) => $day->isManual()))->toBeTrue();

    Notification::assertNothingSent();
});

test('a real check-in clears the manual mark and decides the status', function () {
    Storage::fake('selfies');
    setStatus($this->hr, $this->employee, '2026-10-05', ['status' => 'sick'])->assertSessionHasNoErrors();

    $this->travelTo(F::at('2026-10-05 09:30'));
    F::checkIn($this->employee)->assertCreated();

    $day = AttendanceDay::query()->sole();

    expect($day->status)->toBe(S::Late)
        ->and($day->status_source)->toBeNull()
        ->and($day->status_set_by)->toBeNull()
        ->and($day->late_minutes)->toBe(80);
});

test('HR may not set or clear their own attendance, nor without attendance.manage', function () {
    $direksi = User::factory()->withRole(Role::Direksi)->create();
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->create();

    setStatus($this->hr, $this->hr, '2026-10-02', ['status' => 'present'])->assertForbidden();
    clearDay($this->hr, $this->hr, '2026-10-02')->assertForbidden();
    setStatus($direksi, $this->employee, '2026-10-02', ['status' => 'present'])->assertForbidden();
    setStatus($kadiv, $this->employee, '2026-10-02', ['status' => 'present'])->assertForbidden();
    setStatus($this->employee, $this->employee, '2026-10-02', ['status' => 'present'])->assertForbidden();

    expect(AttendanceDay::query()->count())->toBe(0);
});
