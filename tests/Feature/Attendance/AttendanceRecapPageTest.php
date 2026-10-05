<?php

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Enums\PayrollColumn;
use App\Domain\Attendance\Exports\PayrollRecapExport;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Facades\Excel;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(F::at('2026-10-05 09:15'));
    F::office();
    $this->ops = Division::factory()->create(['name' => 'Operasional']);
    $this->hr = User::factory()->withRole(Role::Hr)->create();
    $this->rizky = F::employee();
    $this->rizky->update(['name' => 'Rizky Aditya', 'division_id' => $this->ops->id]);

    $day = AttendanceDay::factory()->for($this->rizky)->on('2026-09-02')->status(S::Late)->create([
        'check_in_at' => F::at('2026-09-02 08:21')->utc(), 'late_minutes' => 11, 'overtime_minutes' => 90,
    ]);
    AttendanceLog::factory()->forDay($day)->create(['occurred_at' => F::at('2026-09-02 08:21')->utc()]);
    AttendanceDay::factory()->for($this->rizky)->on('2026-09-03')->status(S::Sick)->create();
});

test('HR opens the monthly recap with the detail panel of one employee', function () {
    $this->actingAs($this->hr)->get(route('attendance.recap', ['bulan' => '2026-09', 'karyawan' => $this->rizky->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('attendance/recap')
            ->where('period.month', '2026-09')
            ->where('period.label', 'September 2026')
            ->where('period.previous', '2026-08')
            ->where('report.summary.employees', 1)
            ->where('report.summary.calendarWorkDays', 22)
            ->where('report.summary.lateCount', 1)
            ->where('report.summary.overtimeHours', 1.5)
            ->where('report.rows.0.name', 'Rizky Aditya')
            ->where('report.rows.0.workDays', 22)
            ->where('report.rows.0.presentDays', 1)
            ->where('report.rows.0.lateMinutes', 11)
            ->where('report.rows.0.sickDays', 1)
            ->where('detail.userId', $this->rizky->id)
            ->has('detail.days', 30)
            ->where('detail.days.1.kind', 'late')
            ->has('detail.logs', 1)
            ->where('can.export', true)
            ->where('can.correct', true));
});

test('the detail panel only shows employees in the viewer scope', function () {
    $kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision(Division::factory()->create())->create();

    $this->actingAs($kadiv)->get(route('attendance.recap', ['bulan' => '2026-09', 'karyawan' => $this->rizky->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('detail', null)->where('report.rows', [])->where('can.export', false));
});

test('HR exports the recap to Excel with the configured columns, audited', function () {
    Excel::fake();

    $this->actingAs($this->hr)->get(route('attendance.recap.export', ['format' => 'xlsx', 'bulan' => '2026-09']))->assertOk();

    Excel::assertDownloaded('rekap-absensi-2026-09.xlsx', function (PayrollRecapExport $export): bool {
        expect($export->headings())->toBe(['No. karyawan', 'Nama', 'Divisi', 'Jabatan', 'Hari kerja', 'Hadir', 'Terlambat (kali)', 'Terlambat (menit)', 'Alpha', 'Cuti', 'Izin', 'Sakit', 'Dinas', 'Lembur (jam)'])
            ->and($export->array()[0])->toBe([null, 'Rizky Aditya', 'Operasional', null, 22, 1, 1, 11, 0, 0, 0, 1, 0, 1.5])
            ->and($export->title())->toBe('Rekap September 2026');

        return true;
    });

    expect(AuditLog::query()->where('action', 'attendance.exported')->sole()->new_values)->toMatchArray(['format' => 'xlsx', 'month' => '2026-09', 'rows' => 1]);
});

test('the Excel file is a real spreadsheet', function () {
    $response = $this->actingAs($this->hr)->get(route('attendance.recap.export', ['format' => 'xlsx', 'bulan' => '2026-09']));

    $response->assertOk()->assertDownload('rekap-absensi-2026-09.xlsx');
    expect($response->headers->get('content-type'))->toContain('spreadsheetml');
});

test('export columns follow config/payroll_export.php', function () {
    config(['payroll_export.columns' => ['name' => 'Nama karyawan', 'overtime_hours' => '', 'average_check_in' => 'Masuk rata-rata']]);

    $report = app(MonthlyRecap::class)->report($this->hr, RecapPeriod::forMonth('2026-09', now()));
    $export = new PayrollRecapExport($report);

    expect($export->headings())->toBe(['Nama karyawan', 'Lembur (jam)', 'Masuk rata-rata'])
        ->and($export->array())->toBe([['Rizky Aditya', 1.5, '08.21']]);

    config(['payroll_export.columns' => ['gaji' => 'Gaji']]);
    expect(fn () => PayrollColumn::configured())->toThrow(InvalidArgumentException::class, 'Kolom ekspor payroll tidak dikenal: gaji.');
});

test('HR exports the recap to PDF', function () {
    $response = $this->actingAs($this->hr)->get(route('attendance.recap.export', ['format' => 'pdf', 'bulan' => '2026-09']));

    $response->assertOk()->assertDownload('rekap-absensi-2026-09.pdf');
    expect($response->headers->get('content-type'))->toBe('application/pdf')
        ->and(substr((string) $response->getContent(), 0, 4))->toBe('%PDF');
});

test('only HR and Super Admin may export', function (Role $role, int $status) {
    $this->actingAs(User::factory()->withRole($role)->create())
        ->get(route('attendance.recap.export', ['format' => 'xlsx', 'bulan' => '2026-09']))
        ->assertStatus($status);
})->with([
    [Role::SuperAdmin, 200],
    [Role::Hr, 200],
    [Role::Direksi, 403],
    [Role::KepalaDivisi, 403],
    [Role::Anggota, 403],
]);

test('Absensi Saya shows the personal monthly recap and a personal PDF', function () {
    $this->actingAs($this->rizky)->get(route('attendance.history', ['bulan' => '2026-09']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('attendance/history')
            ->where('period.month', '2026-09')
            ->where('today', '2026-10-05')
            ->where('recap.userId', $this->rizky->id)
            ->where('recap.presentDays', 1)
            ->where('recap.lateCount', 1)
            ->where('recap.sickDays', 1)
            ->has('recap.days', 30)
            ->where('recap.logs.0.canViewSelfie', false));

    $pdf = $this->actingAs($this->rizky)->get(route('attendance.history.pdf', ['bulan' => '2026-09']));
    $pdf->assertOk()->assertDownload('rekap-absensi-saya-2026-09.pdf');
});

test('the history defaults to the current month', function () {
    $this->actingAs($this->rizky)->get(route('attendance.history', ['bulan' => 'x']))
        ->assertInertia(fn (Assert $page) => $page->where('period.month', '2026-10')->where('period.isRunning', true));
});
