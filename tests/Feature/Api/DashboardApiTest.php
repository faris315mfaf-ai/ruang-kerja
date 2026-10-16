<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\Announcement;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

/*
| API v1 — dashboard Kepala Divisi dan HR untuk ponsel (Bagian 2 / B2-B):
| query web yang sama (DivisionDashboard, HrDashboard) di balik Gate
| viewDashboard. Rabu 7 Okt 2026 10.00 WIB, data seperti DivisionDashboardTest.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = $org = F::org();
    $ws = Workspace::factory()->internal()->create();

    F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-10-05', 'completed_at' => '2026-10-05 10:00']);
    F::task($ws, Cat::Todo, [$org['rizky']], ['due_date' => '2026-10-06', 'title' => 'Rekap stok gudang']); // terlambat
    F::task($ws, Cat::Done, [$org['sari']], ['due_date' => '2026-10-06', 'completed_at' => '2026-10-07 09:00']);
    F::task($ws, Cat::Todo, [$org['budi']], ['due_date' => '2026-10-02', 'title' => 'Tagihan vendor KEU']); // divisi lain

    $shift = Shift::factory()->create(['name' => 'Reguler']);
    foreach ([$org['kadiv'], $org['rizky'], $org['sari'], $org['budi']] as $user) {
        ShiftAssignment::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id]);
    }
    F::day($org['rizky'], '2026-10-07', AttendanceStatus::Late, ['shift_id' => $shift->id, 'late_minutes' => 24, 'check_in_at' => F::at('2026-10-07 08:34')]);
    F::day($org['sari'], '2026-10-07', AttendanceStatus::Leave, ['shift_id' => $shift->id]);
    F::day($org['budi'], '2026-10-07', AttendanceStatus::Present, ['shift_id' => $shift->id, 'check_in_at' => F::at('2026-10-07 07:50')]);
});

test('a division head gets their own division with attendance, approvals, reports and metrics', function () {
    Sanctum::actingAs($this->org['kadiv']);

    $this->getJson('/api/v1/dashboard/divisi')
        ->assertOk()
        ->assertJsonPath('view', 'divisi')
        ->assertJsonPath('scope', ['label' => 'Operasional', 'member_count' => 3])
        ->assertJsonPath('filters.periode', 'minggu')
        ->assertJsonPath('filters.divisions', [['id' => $this->org['ops']->id, 'name' => 'Operasional']])
        ->assertJsonPath('attendance.counts.scheduled', 3)
        ->assertJsonPath('attendance.counts.late', 1)
        ->assertJsonPath('attendance.counts.leave', 1)
        ->assertJsonPath('attendance.counts.not_checked_in', 1)
        ->assertJsonPath('approvals.count', 0)
        ->assertJsonPath('reports.totals.scheduled', fn ($scheduled): bool => $scheduled >= 0)
        ->assertJsonPath('metrics.kpis.overdue_tasks.value', 1)
        ->assertJsonPath('metrics.kpis.completion_rate.numerator', 2)
        ->assertJsonPath('metrics.overdue.items.0.title', 'Rekap stok gudang')
        ->assertJsonCount(8, 'metrics.trend')
        ->assertJsonCount(3, 'metrics.workload');
});

test('the division view can be loaded in two steps', function () {
    Sanctum::actingAs($this->org['kadiv']);

    $this->getJson('/api/v1/dashboard/divisi?bagian=langsung')->assertOk()
        ->assertJsonStructure(['scope', 'attendance', 'approvals', 'reports'])
        ->assertJsonMissingPath('metrics');

    $this->getJson('/api/v1/dashboard/divisi?bagian=metrik&periode=bulan')->assertOk()
        ->assertJsonStructure(['scope', 'metrics' => ['kpis', 'trend', 'workload', 'overdue', 'projects']])
        ->assertJsonPath('filters.periode', 'bulan')
        ->assertJsonMissingPath('attendance');
});

test('a division head can never open another division or a plain member the view', function () {
    Sanctum::actingAs($this->org['kadiv']);
    $this->getJson('/api/v1/dashboard/divisi?divisi='.$this->org['keu']->id)->assertForbidden();
    $this->getJson('/api/v1/dashboard/hr')->assertForbidden();

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/dashboard/divisi')->assertForbidden();
    $this->getJson('/api/v1/dashboard/hr')->assertForbidden();
});

test('HR sees any division and can narrow to one', function () {
    Sanctum::actingAs($this->org['hr']);

    $this->getJson('/api/v1/dashboard/divisi')->assertOk()->assertJsonPath('scope.label', 'Semua divisi');
    $this->getJson('/api/v1/dashboard/divisi?divisi='.$this->org['keu']->id)->assertOk()
        ->assertJsonPath('scope.label', 'Keuangan')
        ->assertJsonPath('metrics.kpis.overdue_tasks.value', 1);
});

test('HR gets pending requests, the attendance summary, the briefing card and the announcement slot', function () {
    Announcement::factory()->by($this->org['hr'])->create(['title' => 'Rapat akbar']);
    Sanctum::actingAs($this->org['hr']);

    $this->getJson('/api/v1/dashboard/hr')
        ->assertOk()
        ->assertJsonPath('view', 'hr')
        ->assertJsonPath('attendance.counts.scheduled', 4)
        ->assertJsonPath('attendance.counts.late', 1)
        ->assertJsonPath('attendance.counts.not_checked_in', 1)
        ->assertJsonPath('pending.count', 0)
        ->assertJsonPath('hiring.tersedia', fn ($available): bool => is_bool($available))
        ->assertJsonPath('briefing.is_recorder', true)
        ->assertJsonMissingPath('briefing.urls')
        ->assertJsonPath('pengumuman.items.0.title', 'Rapat akbar')
        ->assertJsonMissingPath('attendance.people');
});

test('Direksi alone gets neither the HR nor the division dashboard', function () {
    Sanctum::actingAs($this->org['direksi']);

    $this->getJson('/api/v1/dashboard/hr')->assertForbidden();
    $this->getJson('/api/v1/dashboard/divisi')->assertForbidden();
});

test('the view picker lists what the viewer may open and marks the landing view', function () {
    Sanctum::actingAs($this->org['kadiv']);

    $this->getJson('/api/v1/dashboard/tampilan')->assertOk()
        ->assertJsonPath('awal', 'divisi')
        ->assertJsonPath('tampilan.0', ['key' => 'saya', 'label' => 'Saya', 'active' => false, 'tersedia' => true])
        ->assertJsonPath('tampilan.1', ['key' => 'divisi', 'label' => 'Kepala Divisi', 'active' => true, 'tersedia' => true]);

    Sanctum::actingAs($this->org['rizky']);
    $this->getJson('/api/v1/dashboard/tampilan')->assertOk()->assertJsonCount(1, 'tampilan');
});

test('dashboards need a token', function () {
    $this->getJson('/api/v1/dashboard/divisi')->assertUnauthorized();
    $this->getJson('/api/v1/dashboard/hr')->assertUnauthorized();
});
