<?php

use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
| API v1 — Monitoring kerja Direksi (Bagian 5 / B5-A): tab Harian,
| Mingguan, Proyek dan akses cepat workspace — DailyWorkMonitor,
| WeeklyWorkMonitor, ProjectWorkMonitor, WorkspaceDirectory web dan Gate
| viewDashboard Direksi. Rabu 7 Okt 2026 10.00 WIB; lima orang terjadwal
| Sen–Jum. Rizky mengirim laporan hari ini (tugas proyek + tugas pribadi +
| di luar tugas), Sari masih draf, Budi mengirim kemarin.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = $org = F::org();
    $shift = Shift::factory()->create(['name' => 'Reguler']);

    foreach (['kadiv', 'rizky', 'sari', 'kadivKeu', 'budi'] as $who) {
        ShiftAssignment::factory()->create(['user_id' => $org[$who]->id, 'shift_id' => $shift->id]);
    }

    $this->project = makeProject($org['kadiv'], ['key' => 'PRJ', 'name' => 'Peluncuran Produk', 'lead_user_id' => $org['kadiv']->id]);
    $this->projectTask = F::task($this->project, Cat::InProgress, [$org['rizky'], $org['budi']], ['title' => 'Siapkan materi', 'due_date' => '2026-10-20']);
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $org['rizky']->id)->first()
        ?? Workspace::factory()->personal($org['rizky'])->create();
    $privateTask = F::task($personal, Cat::Todo, [$org['rizky']], ['title' => 'Urusan pribadi rahasia']);

    $this->rizkyReport = DailyReport::factory()->create([
        'company_id' => $org['rizky']->company_id,
        'user_id' => $org['rizky']->id,
        'report_date' => '2026-10-07',
        'summary' => 'Materi peluncuran setengah jadi.',
        'blockers' => 'Menunggu data vendor.',
        'submitted_at' => F::at('2026-10-07 09:15'),
    ]);
    DailyReportItem::factory()->create(['daily_report_id' => $this->rizkyReport->id, 'task_id' => $this->projectTask->id, 'task_key' => 'PRJ-1', 'task_title' => 'Siapkan materi', 'progress_note' => 'Draf slide', 'percent' => 50, 'hours' => 2, 'position' => 0]);
    DailyReportItem::factory()->create(['daily_report_id' => $this->rizkyReport->id, 'task_id' => $privateTask->id, 'task_key' => 'PRB-1', 'task_title' => 'Urusan pribadi rahasia', 'progress_note' => 'Selesai', 'position' => 1]);
    DailyReportItem::factory()->create(['daily_report_id' => $this->rizkyReport->id, 'progress_note' => 'Bantu tim gudang', 'hours' => 1.5, 'position' => 2]);

    DailyReport::factory()->draft()->create(['company_id' => $org['sari']->company_id, 'user_id' => $org['sari']->id, 'report_date' => '2026-10-07']);

    $budiReport = DailyReport::factory()->create([
        'company_id' => $org['budi']->company_id,
        'user_id' => $org['budi']->id,
        'report_date' => '2026-10-06',
        'summary' => 'Rekap biaya materi.',
        'submitted_at' => F::at('2026-10-06 16:30'),
    ]);
    DailyReportItem::factory()->create(['daily_report_id' => $budiReport->id, 'task_id' => $this->projectTask->id, 'task_key' => 'PRJ-1', 'progress_note' => 'Hitung anggaran', 'percent' => 60, 'hours' => 3, 'position' => 0]);
});

function monitoringAs(object $test, string $who): User
{
    $user = $test->org[$who];
    Sanctum::actingAs($user);

    return $user;
}

it('summarizes today\'s reports per division, hiding private task titles', function () {
    monitoringAs($this, 'direksi');

    $response = $this->getJson('/api/v1/monitoring/harian')
        ->assertOk()
        ->assertJsonPath('today', '2026-10-07')
        ->assertJsonPath('date', '2026-10-07')
        ->assertJsonPath('daily.is_today', true)
        ->assertJsonPath('daily.totals', ['people' => 8, 'scheduled' => 5, 'reported' => 1, 'draft' => 1, 'missing' => 3])
        ->assertJsonCount(1, 'daily.reports')
        ->assertJsonPath('daily.reports.0.id', $this->rizkyReport->id)
        ->assertJsonPath('daily.reports.0.blockers', 'Menunggu data vendor.')
        ->assertJsonPath('daily.reports.0.items.0.title', 'Siapkan materi')
        ->assertJsonPath('daily.reports.0.items.1.key', 'PRB-1')
        ->assertJsonPath('daily.reports.0.items.1.title', null);

    expect(array_column($response->json('daily.missing'), 'name'))->toBe(['Budi Keu', 'Dimas Pratama', 'Lestari Keu', 'Sari Wulandari']);

    // The detail sheet (B4-C endpoint) opens the same report.
    $this->getJson('/api/v1/monitoring/laporan/'.$this->rizkyReport->id)->assertOk()->assertJsonPath('report.id', $this->rizkyReport->id);
});

it('picks another day and refuses future or malformed dates', function () {
    monitoringAs($this, 'direksi');

    $this->getJson('/api/v1/monitoring/harian?tanggal=2026-10-06')->assertOk()
        ->assertJsonPath('date', '2026-10-06')
        ->assertJsonPath('daily.is_today', false)
        ->assertJsonPath('daily.reports.0.user.name', 'Budi Keu');

    foreach (['2026-10-30', '2026-02-31', 'kemarin'] as $value) {
        $this->getJson('/api/v1/monitoring/harian?tanggal='.$value)->assertOk()->assertJsonPath('date', '2026-10-07');
    }
});

it('builds the weekly person × day matrix, top tasks and blockers', function () {
    monitoringAs($this, 'direksi');

    $response = $this->getJson('/api/v1/monitoring/mingguan')->assertOk()
        ->assertJsonPath('week', '2026-10-05')
        ->assertJsonPath('weekly.week.start', '2026-10-05')
        ->assertJsonPath('weekly.week.previous', '2026-09-28')
        ->assertJsonPath('weekly.week.next', null)
        ->assertJsonPath('weekly.totals', ['expected' => 15, 'reported' => 2, 'hours' => 6.5, 'people_reported' => 2])
        ->assertJsonCount(1, 'weekly.top_tasks')
        ->assertJsonPath('weekly.top_tasks.0.key', 'PRJ-1')
        ->assertJsonPath('weekly.blockers.0.report_id', $this->rizkyReport->id);

    $ops = collect($response->json('weekly.divisions'))->firstWhere('name', 'Operasional');
    $rizky = collect($ops['people'])->firstWhere('user.name', 'Rizky Aditya');
    expect(array_column($rizky['days'], 'state'))->toBe(['missing', 'missing', 'reported', 'future', 'future', 'future', 'future']);

    $this->getJson('/api/v1/monitoring/mingguan?minggu=2026-09-30')->assertOk()
        ->assertJsonPath('week', '2026-09-28')
        ->assertJsonPath('weekly.week.next', '2026-10-05');
});

it('tracks open projects with this week\'s reports', function () {
    monitoringAs($this, 'direksi');

    $this->getJson('/api/v1/monitoring/proyek')->assertOk()
        ->assertJsonPath('week', '2026-10-05')
        ->assertJsonPath('projects.total', 1)
        ->assertJsonPath('projects.projects.0.key', 'PRJ')
        ->assertJsonPath('projects.projects.0.week', ['reports' => 2, 'people' => 2, 'tasks' => 1, 'hours' => 5]);
});

it('lists shared workspaces for quick access with search and type filters', function () {
    Workspace::factory()->state(['type' => 'team'])->create(['company_id' => $this->org['direksi']->company_id, 'key' => 'TIM', 'name' => 'Tim Konten']);
    monitoringAs($this, 'direksi');

    $all = $this->getJson('/api/v1/monitoring/workspace')->assertOk()->assertJsonPath('filters', ['q' => null, 'jenis' => null]);
    $keys = collect($all->json('workspaces'))->pluck('key');
    expect($keys)->toContain('PRJ', 'TIM', 'OPS', 'KEU')
        ->and(collect($all->json('workspaces'))->pluck('type')->unique()->sort()->values()->all())->toBe(['division', 'project', 'team'])
        ->and(collect($all->json('workspaces'))->firstWhere('key', 'TIM')['view_only'])->toBeTrue();

    $this->getJson('/api/v1/monitoring/workspace?jenis=project')->assertOk()
        ->assertJsonCount(1, 'workspaces')->assertJsonPath('workspaces.0.key', 'PRJ');
    $this->getJson('/api/v1/monitoring/workspace?q=konten')->assertOk()
        ->assertJsonCount(1, 'workspaces')->assertJsonPath('workspaces.0.name', 'Tim Konten');
});

it('is only for the Direksi view (Direksi, Super Admin)', function () {
    foreach (['hr', 'kadiv', 'rizky'] as $who) {
        monitoringAs($this, $who);

        foreach (['harian', 'mingguan', 'proyek', 'workspace'] as $tab) {
            $this->getJson('/api/v1/monitoring/'.$tab)->assertForbidden();
        }
    }

    $this->org['admin']->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_recovery_codes' => encrypt('[]'), 'two_factor_confirmed_at' => now()])->save();
    monitoringAs($this, 'admin');
    $this->getJson('/api/v1/monitoring/harian')->assertOk();
});
