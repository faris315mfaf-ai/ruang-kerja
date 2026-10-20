<?php

use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Enums\RequestPortion;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Models\Division;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AttendanceFixtures as F;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Absensi › Pegawai (keputusan pemilik 20 Okt 2026): the month grid, the day
 * sheet JSON and the HR phone API. Senin 5 Okt 2026 09.15 WIB.
 */

beforeEach(function () {
    Event::fake([AttendanceRecorded::class]);
    $this->travelTo(F::at('2026-10-05 09:15'));
    $this->home = homeWorld();
    $this->ops = Division::factory()->create(['name' => 'Gudang']);
    $this->employee = F::employee();
    $this->employee->forceFill(['name' => 'Rina Gudang', 'division_id' => $this->ops->id])->save();
});

test('HR sees every employee × day of the month with cell codes and today tiles', function () {
    AttendanceDay::factory()->for($this->employee)->on('2026-10-01')->status(S::Present)->create([
        'check_in_at' => F::at('2026-10-01 07:55')->utc(),
        'check_out_at' => F::at('2026-10-01 17:02')->utc(),
    ]);
    AttendanceDay::factory()->for($this->employee)->on('2026-10-02')->status(S::Leave)->create(['request_portion' => RequestPortion::Full]);
    AttendanceDay::factory()->for($this->employee)->on('2026-10-03')->status(S::Absent)->create([
        'status_source' => 'manual', 'status_set_by' => $this->home->hr->id, 'status_set_at' => now(),
    ]);

    $this->actingAs($this->home->hr)
        ->get(route('attendance.employees.index', ['q' => 'Rina']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('attendance/employees')
            ->where('period.month', '2026-10')
            ->where('filters.q', 'Rina')
            ->where('filters.bermasalah', false)
            ->where('can.set_status', true)
            ->where('can.payroll', true)
            ->has('grid.rows', 1)
            ->where('grid.rows.0.name', 'Rina Gudang')
            ->where('grid.rows.0.initials', 'RG')
            ->where('grid.rows.0.division', 'Gudang')
            ->has('grid.rows.0.cells', 31)
            ->where('grid.rows.0.cells.0', [
                'date' => '2026-10-01', 'code' => 'present', 'check_in' => '07.55', 'check_out' => '17.02',
                'manual' => false, 'from_request' => false, 'has_logs' => false,
            ])
            ->where('grid.rows.0.cells.1.code', 'leave')
            ->where('grid.rows.0.cells.1.from_request', true)
            ->where('grid.rows.0.cells.2.code', 'absent')
            ->where('grid.rows.0.cells.2.manual', true)
            ->where('grid.rows.0.cells.3.code', 'off')
            ->where('grid.rows.0.cells.4.code', 'not_checked_in')
            ->where('grid.rows.0.cells.5.code', 'future')
            ->where('grid.rows.0.totals', ['present' => 1, 'late' => 0, 'absent' => 1, 'permit_sick_leave' => 1])
            ->where('grid.today.not_checked_in', 1)
            ->where('grid.today.absent_month', 1)
        );
});

test('"hanya bermasalah" keeps employees with Alpha, corrections or missing days', function () {
    $fine = F::employee();
    $fine->forceFill(['name' => 'Bagus Rajin', 'division_id' => $this->ops->id])->save();
    $this->travelTo(F::at('2026-10-02 18:00'));

    foreach (['2026-10-01', '2026-10-02'] as $date) {
        AttendanceDay::factory()->for($fine)->on($date)->status(S::Present)->create(['check_in_at' => F::at($date.' 07:50')->utc()]);
    }

    AttendanceDay::factory()->for($this->employee)->on('2026-10-01')->status(S::Absent)->create();

    $this->actingAs($this->home->hr)
        ->get(route('attendance.employees.index', ['divisi' => $this->ops->id, 'bermasalah' => 1]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.divisi', $this->ops->id)
            ->has('grid.rows', 1)
            ->where('grid.rows.0.name', 'Rina Gudang'));
});

test('the day sheet shows status, manual mark, history and the wage effect', function () {
    EmployeeWage::factory()->forEmployee($this->employee)->amount(150_000)->create();

    $this->actingAs($this->home->hr)
        ->put(route('attendance.employees.update', ['employee' => $this->employee->id, 'date' => '2026-10-02']), ['status' => 'sick', 'reason' => 'Surat dokter menyusul'])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->home->hr)
        ->getJson(route('attendance.employees.show', ['employee' => $this->employee->id, 'date' => '2026-10-02']))
        ->assertOk()
        ->assertJsonPath('employee.name', 'Rina Gudang')
        ->assertJsonPath('status', 'sick')
        ->assertJsonPath('status_label', 'Sakit')
        ->assertJsonPath('manual', true)
        ->assertJsonPath('set_by', $this->home->hr->name)
        ->assertJsonPath('from_request', false)
        ->assertJsonPath('has_logs', false)
        ->assertJsonPath('locked', false)
        ->assertJsonPath('can.set_status', true)
        ->assertJsonPath('can.clear', true)
        ->assertJsonPath('history.0.action', 'attendance.status_set')
        ->assertJsonPath('history.0.reason', 'Surat dokter menyusul')
        ->assertJsonPath('history.0.to_status', 'sick')
        ->assertJsonPath('wage_effect.paid', true)
        ->assertJsonPath('wage_effect.label', 'Dibayar · Sakit')
        ->assertJsonPath('wage_effect.daily_wage', 150_000);

    // An empty scheduled past day: nothing recorded yet.
    $this->actingAs($this->home->hr)
        ->getJson(route('attendance.employees.show', ['employee' => $this->employee->id, 'date' => '2026-10-01']))
        ->assertOk()
        ->assertJsonPath('exists', false)
        ->assertJsonPath('scheduled', true)
        ->assertJsonPath('can.clear', false)
        ->assertJsonPath('wage_effect.pending', true);
});

test('access: HR and Super Admin; Direksi, Kepala Divisi and staff get 403', function () {
    foreach ([$this->home->hr, $this->home->superAdmin] as $allowed) {
        $this->actingAs($allowed)->get(route('attendance.employees.index'))->assertOk();
    }

    foreach ([$this->home->direksi, $this->home->kadiv, $this->home->anggota] as $denied) {
        $this->actingAs($denied)->get(route('attendance.employees.index'))->assertForbidden();
        $this->actingAs($denied)->getJson(route('attendance.employees.show', ['employee' => $this->employee->id, 'date' => '2026-10-01']))->assertForbidden();
    }
});

test('another company\'s employee is a 404 and nothing of company B shows', function () {
    $foreign = foreignWorld();

    $this->actingAs($this->home->hr)
        ->getJson(route('attendance.employees.show', ['employee' => $foreign->anggota->id, 'date' => '2026-10-01']))
        ->assertNotFound();
    $this->actingAs($this->home->hr)
        ->put(route('attendance.employees.update', ['employee' => $foreign->anggota->id, 'date' => '2026-10-01']), ['status' => 'absent', 'reason' => 'Coba lintas perusahaan'])
        ->assertNotFound();
    $this->actingAs($this->home->hr)
        ->delete(route('attendance.employees.destroy', ['employee' => $foreign->anggota->id, 'date' => '2026-10-05']), ['reason' => 'Coba lintas perusahaan'])
        ->assertNotFound();

    $page = $this->actingAs($this->home->hr)->get(route('attendance.employees.index'))->assertOk();

    expect(leaksForeign($page->getContent()))->toBeFalse()
        ->and($foreign->day->fresh())->not->toBeNull();
});

test('the HR phone API sets and clears a day with the same rules', function () {
    Sanctum::actingAs($this->home->hr);

    $this->putJson("/api/v1/absensi/hari/{$this->employee->id}/2026-10-02", ['status' => 'business_trip', 'check_in' => '08:00', 'reason' => 'Dinas ke cabang Bekasi'])
        ->assertOk()
        ->assertJsonPath('day.status', 'business_trip')
        ->assertJsonPath('day.workDate', '2026-10-02');

    $this->putJson("/api/v1/absensi/hari/{$this->employee->id}/2026-10-01", ['status' => 'absent', 'reason' => 'Tidak ada kabar'])->assertOk();
    $this->deleteJson("/api/v1/absensi/hari/{$this->employee->id}/2026-10-01", ['reason' => 'Ternyata libur kantor'])
        ->assertOk()
        ->assertJsonPath('day', null);
    $this->deleteJson("/api/v1/absensi/hari/{$this->employee->id}/2026-10-02", ['reason' => 'Coba hapus dinas'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('work_date');
    $this->putJson("/api/v1/absensi/hari/{$this->employee->id}/2026-10-09", ['status' => 'present', 'reason' => 'Belum terjadi'])
        ->assertUnprocessable();

    $this->getJson('/api/v1/absensi/tim/rekap')->assertOk()->assertJsonPath('can.set_status', true);

    Sanctum::actingAs($this->home->direksi);
    $this->putJson("/api/v1/absensi/hari/{$this->employee->id}/2026-10-01", ['status' => 'absent', 'reason' => 'Tidak ada kabar'])->assertForbidden();
    $this->getJson('/api/v1/absensi/tim/rekap')->assertOk()->assertJsonPath('can.set_status', false);
});
