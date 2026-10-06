<?php

use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Maatwebsite\Excel\Facades\Excel;
use Tests\Support\AnalyticsFixtures as F;

/*
 * Absensi › Kedisiplinan (keputusan pemilik 6 Okt 2026): the discipline
 * recap that left the HR dashboard plus tingkat penyelesaian and lead time.
 * "Today" is Wednesday 7 Oct 2026; the default period is October to date.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = $org = F::org();
    $shift = Shift::factory()->create(['name' => 'Reguler']);

    // Rizky: late twice (10 + 20 min) and present once. Sari: absent once, present once. Budi (Keuangan): present twice.
    F::day($org['rizky'], '2026-10-01', AttendanceStatus::Late, ['shift_id' => $shift->id, 'late_minutes' => 10]);
    F::day($org['rizky'], '2026-10-02', AttendanceStatus::Late, ['shift_id' => $shift->id, 'late_minutes' => 20]);
    F::day($org['rizky'], '2026-10-05', AttendanceStatus::Present, ['shift_id' => $shift->id]);
    F::day($org['sari'], '2026-10-01', AttendanceStatus::Absent, ['shift_id' => $shift->id]);
    F::day($org['sari'], '2026-10-02', AttendanceStatus::Present, ['shift_id' => $shift->id]);
    F::day($org['budi'], '2026-10-01', AttendanceStatus::Present, ['shift_id' => $shift->id]);
    F::day($org['budi'], '2026-10-02', AttendanceStatus::Present, ['shift_id' => $shift->id]);

    // Tasks due in October: Rizky 2 (1 done on time after 2 days), Budi 1 open after today.
    $ws = Workspace::factory()->internal()->create(['company_id' => $org['hr']->company_id]);
    F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-10-05', 'created_at' => '2026-10-02 09:00', 'completed_at' => '2026-10-04 09:00']);
    F::task($ws, Cat::Todo, [$org['rizky']], ['due_date' => '2026-10-06']);
    F::task($ws, Cat::Todo, [$org['budi']], ['due_date' => '2026-10-20']);
});

/**
 * @return array<string, mixed>
 */
function disciplineReport(object $test, string $who, string $query = ''): array
{
    $report = [];
    $test->actingAs($test->org[$who])->get('/absensi/kedisiplinan'.$query)
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$report): void {
            $page->component('attendance/discipline')
                ->missing('report')
                ->loadDeferredProps(function (Assert $reload) use (&$report): void {
                    $report = $reload->toArray()['props']['report'];
                });
        });

    return $report;
}

it('opens Kedisiplinan for HR, Direksi, Super Admin and team leads only', function (string $who, int $status) {
    $this->actingAs($this->org[$who])->get('/absensi/kedisiplinan')->assertStatus($status);
    $this->actingAs($this->org[$who])->get('/absensi/kedisiplinan/ekspor')->assertStatus($status);
})->with([
    ['hr', 200],
    ['direksi', 200],
    ['admin', 200],
    ['kadiv', 200],
    ['rizky', 403],
]);

it('recaps discipline, completion and lead time for the company', function () {
    $report = disciplineReport($this, 'hr');

    // Scheduled days 7, on time 4 (Rizky 1, Sari 1, Budi 2).
    expect($report['kpis']['attendance_discipline'])->toMatchArray(['value' => 57, 'numerator' => 4, 'denominator' => 7])
        ->and($report['kpis']['average_lateness']['value'])->toEqual(15)
        ->and($report['kpis']['absent_days']['value'])->toEqual(1)
        ->and($report['kpis']['late_days']['value'])->toEqual(2)
        // October to date: 1 of the 2 tasks due by today is done; lead time 2 days.
        ->and($report['kpis']['completion_rate'])->toMatchArray(['value' => 50, 'numerator' => 1, 'denominator' => 2])
        ->and($report['kpis']['lead_time']['value'])->toEqual(2)
        ->and($report['trend'])->toHaveCount(8);

    $people = collect($report['people']);
    expect($people->pluck('user.name')->take(3)->all())->toBe(['Sari Wulandari', 'Rizky Aditya', 'Budi Keu'])
        ->and($people->firstWhere('user.name', 'Rizky Aditya'))->toMatchArray(['scheduled' => 3, 'on_time' => 1, 'discipline' => 33, 'late_days' => 2, 'average_late' => 15, 'absent_days' => 0])
        ->and($people->firstWhere('user.name', 'Sari Wulandari'))->toMatchArray(['absent_days' => 1, 'discipline' => 50])
        ->and($people->firstWhere('user.name', 'Hana HR'))->toMatchArray(['scheduled' => 0, 'discipline' => null]);
});

it('limits a Kepala Divisi to their division and refuses other divisions', function () {
    $report = disciplineReport($this, 'kadiv');

    expect(collect($report['people'])->pluck('user.name')->sort()->values()->all())->toBe(['Dimas Pratama', 'Rizky Aditya', 'Sari Wulandari'])
        ->and($report['kpis']['completion_rate']['denominator'])->toEqual(2);

    $this->actingAs($this->org['kadiv'])->get('/absensi/kedisiplinan?divisi='.$this->org['keu']->id)->assertForbidden();
});

it('filters by division and period', function () {
    $keu = disciplineReport($this, 'hr', '?divisi='.$this->org['keu']->id);
    expect(collect($keu['people'])->pluck('user.name')->sort()->values()->all())->toBe(['Budi Keu', 'Lestari Keu'])
        ->and($keu['kpis']['attendance_discipline']['value'])->toEqual(100);

    $week = disciplineReport($this, 'hr', '?periode=minggu');
    // This week (Mon 5 Oct): only Rizky's present day.
    expect($week['kpis']['attendance_discipline'])->toMatchArray(['value' => 100, 'numerator' => 1, 'denominator' => 1]);
});

it('exports the same numbers to Excel and audits the export', function () {
    Excel::fake();

    $this->actingAs($this->org['hr'])->get('/absensi/kedisiplinan/ekspor')->assertOk();

    Excel::assertDownloaded('kedisiplinan-2026-10-07.xlsx', fn (DashboardExport $export): bool => collect($export->sheets())->map->title()->all() === ['Ringkasan', 'Tren kedisiplinan', 'Per orang']);
    $this->assertDatabaseHas('audit_logs', ['action' => 'attendance.discipline_exported', 'user_id' => $this->org['hr']->id]);
});

it('shows the Absensi tabs on the board and the recap too', function () {
    $this->actingAs($this->org['hr'])->get('/absensi/hari-ini')->assertOk()->assertInertia(fn (Assert $page) => $page->component('attendance/board'));
    $this->actingAs($this->org['hr'])->get('/absensi/rekap')->assertOk()->assertInertia(fn (Assert $page) => $page->component('attendance/recap'));
    $this->actingAs(User::factory()->create())->get('/absensi/kedisiplinan')->assertForbidden();
});
