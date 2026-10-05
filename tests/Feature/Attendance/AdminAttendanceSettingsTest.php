<?php

use App\Domain\Attendance\Actions\ImportHolidays;
use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->hr = User::factory()->withRole(Role::Hr)->create();
});

test('HR opens the settings page with locations, shifts and holidays', function () {
    $office = F::office();
    $shift = Shift::factory()->atLocation($office)->create(['name' => 'Reguler']);
    ShiftAssignment::factory()->count(2)->for($shift)->create();
    Holiday::factory()->on('2026-12-25', 'Hari Raya Natal')->create();
    $this->travelTo(F::at('2026-10-05 09:00'));

    $this->actingAs($this->hr)->get(route('admin.attendance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/attendance/index')
            ->has('locations', 1)
            ->where('locations.0.name', 'Kantor Pusat')
            ->where('locations.0.employeesCount', 2)
            ->where('shifts.0.hours', '08.00–17.00')
            ->where('shifts.0.daysLabel', 'Sen–Jum')
            ->where('shifts.0.employeesCount', 2)
            ->where('shifts.0.locationName', 'Kantor Pusat')
            ->where('holidays.0.name', 'Hari Raya Natal')
            ->where('holidays.0.typeLabel', 'Nasional')
            ->where('geofence.maxRadius', 500));
});

test('members cannot open or change the settings', function (Role $role) {
    $actor = User::factory()->withRole($role)->create();
    $location = F::office();

    $this->actingAs($actor)->get(route('admin.attendance.index'))->assertForbidden();
    $this->actingAs($actor)->get(route('admin.attendance.assignments.index'))->assertForbidden();
    $this->actingAs($actor)->put(route('admin.attendance.locations.update', $location), [
        'name' => 'X', 'latitude' => 0, 'longitude' => 0, 'radius_m' => 100, 'is_active' => true,
    ])->assertForbidden();
    $this->actingAs($actor)->post(route('admin.attendance.holidays.store'), ['date' => '2026-12-31', 'name' => 'X', 'type' => 'company'])->assertForbidden();
})->with([Role::Direksi, Role::KepalaDivisi, Role::Anggota]);

test('HR creates, updates and deletes an office location (audited)', function () {
    $this->actingAs($this->hr)->post(route('admin.attendance.locations.store'), [
        'name' => 'Gudang Cikarang',
        'address' => 'Jl. Industri 1',
        'latitude' => -6.3001234,
        'longitude' => 107.1501234,
        'radius_m' => 150,
        'is_active' => true,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $location = OfficeLocation::query()->sole();
    expect($location->radius_m)->toBe(150)->and($location->latitude)->toBe(-6.3001234);

    $shift = Shift::factory()->atLocation($location)->create();

    $this->actingAs($this->hr)->put(route('admin.attendance.locations.update', $location), [
        'name' => 'Gudang Cikarang', 'latitude' => -6.3, 'longitude' => 107.15, 'radius_m' => 200, 'is_active' => false,
    ])->assertRedirect()->assertSessionHasNoErrors();
    expect($location->fresh()?->is_active)->toBeFalse();

    $this->actingAs($this->hr)->delete(route('admin.attendance.locations.destroy', $location))->assertRedirect();

    expect(OfficeLocation::query()->count())->toBe(0)
        ->and(OfficeLocation::withTrashed()->count())->toBe(1)
        ->and($shift->fresh()?->office_location_id)->toBeNull()
        ->and(AuditLog::query()->where('action', 'like', 'office_location.%')->count())->toBe(3);
});

test('location input is validated', function () {
    $this->actingAs($this->hr)->post(route('admin.attendance.locations.store'), [
        'name' => '', 'latitude' => 120, 'longitude' => 200, 'radius_m' => 20, 'is_active' => true,
    ])->assertSessionHasErrors(['name', 'latitude', 'longitude', 'radius_m']);
});

test('HR manages shifts; crossing midnight is derived from the times', function () {
    $this->actingAs($this->hr)->post(route('admin.attendance.shifts.store'), [
        'name' => 'Gudang Malam',
        'start_time' => '22:00',
        'end_time' => '06:00',
        'break_minutes' => 30,
        'late_tolerance_min' => 10,
        'early_leave_tolerance_min' => 0,
        'check_in_window_before_min' => 60,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $shift = Shift::query()->sole();
    expect($shift->crosses_midnight)->toBeTrue()->and($shift->hoursLabel())->toBe('22.00–06.00');

    $this->actingAs($this->hr)->put(route('admin.attendance.shifts.update', $shift), [
        'name' => 'Gudang Sore', 'start_time' => '14:00', 'end_time' => '22:00', 'break_minutes' => 30,
        'late_tolerance_min' => 5, 'early_leave_tolerance_min' => 0, 'check_in_window_before_min' => 60,
    ])->assertSessionHasNoErrors();
    expect($shift->fresh()?->crosses_midnight)->toBeFalse();

    $this->actingAs($this->hr)->delete(route('admin.attendance.shifts.destroy', $shift))->assertSessionHasNoErrors();
    expect(Shift::query()->count())->toBe(0);
});

test('a shift in use cannot be deleted', function () {
    $shift = Shift::factory()->create(['name' => 'Reguler']);
    ShiftAssignment::factory()->count(3)->for($shift)->create();

    $this->actingAs($this->hr)->delete(route('admin.attendance.shifts.destroy', $shift))
        ->assertSessionHasErrors(['shift' => 'Shift Reguler masih dipakai 3 karyawan. Pindahkan penugasannya ke shift lain terlebih dulu.']);

    expect(Shift::query()->count())->toBe(1);
});

test('shift times are validated', function () {
    $this->actingAs($this->hr)->post(route('admin.attendance.shifts.store'), [
        'name' => 'X', 'start_time' => '25:00', 'end_time' => '25:00', 'break_minutes' => -1,
        'late_tolerance_min' => 10, 'early_leave_tolerance_min' => 0, 'check_in_window_before_min' => 60,
    ])->assertSessionHasErrors(['start_time', 'end_time', 'break_minutes']);
});

test('HR manages holidays with a unique date', function () {
    $this->actingAs($this->hr)->post(route('admin.attendance.holidays.store'), [
        'date' => '2026-12-25', 'name' => 'Hari Raya Natal', 'type' => 'national',
    ])->assertSessionHasNoErrors();

    $this->actingAs($this->hr)->post(route('admin.attendance.holidays.store'), [
        'date' => '2026-12-25', 'name' => 'Duplikat', 'type' => 'company',
    ])->assertSessionHasErrors(['date' => 'Tanggal ini sudah terdaftar sebagai hari libur.']);

    $holiday = Holiday::query()->sole();
    $this->actingAs($this->hr)->put(route('admin.attendance.holidays.update', $holiday), [
        'date' => '2026-12-25', 'name' => 'Natal', 'type' => 'national',
    ])->assertSessionHasNoErrors();
    expect($holiday->fresh()?->name)->toBe('Natal');

    $this->actingAs($this->hr)->delete(route('admin.attendance.holidays.destroy', $holiday))->assertRedirect();
    expect(Holiday::query()->count())->toBe(0);
});

test('holidays are imported from CSV with header, semicolons and Indonesian dates', function () {
    Holiday::factory()->on('2026-12-25', 'Natal lama')->create();
    $csv = "tanggal;nama;jenis\n2026-12-24;Cuti bersama Natal;cuti bersama\n25/12/2026;Hari Raya Natal;nasional\n1/1/2027;Tahun Baru Masehi;\n";

    $this->actingAs($this->hr)->post(route('admin.attendance.holidays.import'), [
        'file' => UploadedFile::fake()->createWithContent('libur.csv', $csv),
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect(Holiday::query()->orderBy('date')->get()->map(fn (Holiday $h) => [$h->date->toDateString(), $h->name, $h->type])->all())
        ->toBe([
            ['2026-12-24', 'Cuti bersama Natal', HolidayType::CollectiveLeave],
            ['2026-12-25', 'Hari Raya Natal', HolidayType::National],
            ['2027-01-01', 'Tahun Baru Masehi', HolidayType::National],
        ]);
});

test('an invalid CSV is rejected with line numbers and nothing is saved', function () {
    $csv = "2026-12-24,Cuti bersama,cuti bersama\n2026-13-01,Salah tanggal\n2026-12-31,,nasional\n2027-01-02,Libur,tidak dikenal\n2026-12-24,Ganda\n";

    $this->actingAs($this->hr)->post(route('admin.attendance.holidays.import'), [
        'file' => UploadedFile::fake()->createWithContent('libur.csv', $csv),
    ])->assertSessionHasErrors(['file' => 'Impor dibatalkan: ada 4 baris bermasalah.']);

    expect(Holiday::query()->count())->toBe(0);
});

test('the holiday import reports each bad line', function () {
    $report = app(ImportHolidays::class)->handle(
        $this->hr,
        UploadedFile::fake()->createWithContent('libur.csv', "Tanggal,Nama\n2026-13-01,X\n2026-12-31,\n"),
    );

    expect($report->errors)->toBe([
        ['line' => 2, 'message' => 'Tanggal tidak valid. Pakai format YYYY-MM-DD atau DD/MM/YYYY.'],
        ['line' => 3, 'message' => 'Nama hari libur wajib diisi (maksimal 150 karakter).'],
    ]);
});
