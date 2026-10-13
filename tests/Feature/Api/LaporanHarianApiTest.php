<?php

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\DailyReport;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — Laporan progres harian (Bagian 4 / B4-C): formulir hari ini,
| autosave, kirim (pindah tugas lewat MoveTask), cari tugas, riwayat bulan,
| detail, laporan tim dan detail monitoring — Action/Query/Policy web yang
| sama. Rabu 7 Okt 2026 14.00 WIB; Rizky (staf Operasional) melapor ke Dimas
| (Kadiv); Senin–Jumat terjadwal.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 14:00', 'Asia/Jakarta'));
    $this->org = F::org();
    $this->me = $this->org['rizky'];
    $this->me->update(['joined_at' => '2025-01-06']);

    $shift = F::shift();
    foreach (['rizky', 'sari', 'budi', 'kadiv'] as $who) {
        ShiftAssignment::factory()->create(['user_id' => $this->org[$who]->id, 'shift_id' => $shift->id]);
    }

    $this->project = Workspace::factory()->internal()->create(['key' => 'PRJ']);
    addMember($this->project, $this->me);
    // Private team workspace: Dimas (Kadiv) cannot see it.
    $this->private = Workspace::factory()->state(['type' => 'team'])->create(['key' => 'PRV']);
    addMember($this->private, $this->me);
    // Rizky is only a viewer here: he may not move its tasks.
    $this->readOnly = Workspace::factory()->internal()->create(['key' => 'RO']);
    addMember($this->readOnly, $this->me, WorkspaceRole::Viewer);

    $this->task = F::task($this->project, Cat::InProgress, [$this->me], ['title' => 'Rekap stok gudang']);
    $this->secret = F::task($this->private, Cat::Todo, [$this->me], ['title' => 'Rahasia tim']);
    $this->locked = F::task($this->readOnly, Cat::Todo, [], ['title' => 'Hanya lihat']);
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function apiReport(array $overrides = []): array
{
    return [
        'report_date' => '2026-10-07',
        'summary' => 'Rekap stok selesai.',
        'blockers' => 'Menunggu data cabang.',
        'notes' => 'Notulen rapat pagi.',
        'items' => [],
        ...$overrides,
    ];
}

test('today returns an empty form with the deadline, schedule and movable suggestions', function () {
    Sanctum::actingAs($this->me);

    $this->getJson('/api/v1/laporan/hari-ini')
        ->assertOk()
        ->assertJsonPath('date', '2026-10-07')
        ->assertJsonPath('deadline', '2026-10-07T16:59:59+00:00')
        ->assertJsonPath('locked', false)
        ->assertJsonPath('scheduled', true)
        ->assertJsonPath('holiday', null)
        ->assertJsonPath('can', ['edit' => true, 'submit' => true])
        ->assertJsonPath('report.status', 'missing')
        ->assertJsonPath('report.id', null)
        ->assertJsonPath('report.locked', false)
        ->assertJsonPath('limits.items', 30)
        ->assertJsonPath('suggestions.0.key', 'PRJ-1')
        ->assertJsonPath('suggestions.0.status.category', 'in_progress')
        ->assertJsonPath('suggestions.0.can_move', true)
        ->assertJsonCount(5, 'suggestions.0.statuses')
        ->assertJsonPath('chosen', []);
});

test('today flags a holiday as not scheduled', function () {
    Holiday::factory()->create(['company_id' => $this->me->company_id, 'date' => '2026-10-07', 'name' => 'Libur kantor']);
    Sanctum::actingAs($this->me);

    $this->getJson('/api/v1/laporan/hari-ini')
        ->assertOk()
        ->assertJsonPath('scheduled', false)
        ->assertJsonPath('holiday', 'Libur kantor')
        ->assertJsonPath('can.edit', true);
});

test('autosave stores a draft idempotently and defaults the date to today', function () {
    Sanctum::actingAs($this->me);
    $body = apiReport(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'Separuh selesai', 'percent' => 50, 'hours' => 3.5],
        ['task_id' => null, 'progress_note' => 'Membantu stok opname'],
    ]]);

    foreach ([1, 2] as $_) {
        $this->putJson('/api/v1/laporan/hari-ini', $body)
            ->assertOk()
            ->assertJsonPath('report.status', 'draft')
            ->assertJsonPath('report.locked', false)
            ->assertJsonPath('report.items.0.task_key', 'PRJ-1')
            ->assertJsonPath('report.items.0.task_title', 'Rekap stok gudang')
            ->assertJsonPath('report.items.1.is_task', false)
            ->assertJsonPath('report.hours', 3.5);
    }

    expect(DailyReport::query()->count())->toBe(1)
        ->and(DailyReport::query()->sole()->items)->toHaveCount(2);

    // Without report_date: today's office date.
    $this->putJson('/api/v1/laporan/hari-ini', ['summary' => 'Tanpa tanggal', 'items' => []])
        ->assertOk()->assertJsonPath('report.date', '2026-10-07')->assertJsonPath('report.items_count', 0);
    // `items` is required: an autosave without it must not wipe the rows.
    $this->putJson('/api/v1/laporan/hari-ini', ['summary' => 'x'])
        ->assertUnprocessable()->assertJsonValidationErrors('items');

    $this->getJson('/api/v1/laporan/hari-ini')
        ->assertOk()->assertJsonPath('report.status', 'draft')->assertJsonPath('report.summary', 'Tanpa tanggal');
});

test('submit moves tasks and reports the move per task; resending keeps the first send time', function () {
    $done = F::status($this->project, Cat::Done);
    Sanctum::actingAs($this->me);

    $this->postJson('/api/v1/laporan/hari-ini/kirim', apiReport())
        ->assertUnprocessable()->assertJsonValidationErrors('items');
    $this->postJson('/api/v1/laporan/hari-ini/kirim', apiReport(['items' => [['task_id' => $this->task->id, 'progress_note' => '']]]))
        ->assertUnprocessable()->assertJsonValidationErrors('items.0.progress_note');

    $body = apiReport(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'Selesai', 'percent' => 100, 'move_status_id' => $done->id],
        ['task_id' => null, 'progress_note' => 'Rapat'],
    ]]);

    $this->postJson('/api/v1/laporan/hari-ini/kirim', $body)
        ->assertOk()
        ->assertJsonPath('message', 'Laporan hari ini terkirim.')
        ->assertJsonPath('report.status', 'submitted')
        ->assertJsonPath('report.items.0.status_category_after', 'done')
        ->assertJsonCount(1, 'move_results')
        ->assertJsonPath('move_results.0.task_id', $this->task->id)
        ->assertJsonPath('move_results.0.task_key', 'PRJ-1')
        ->assertJsonPath('move_results.0.moved', true)
        ->assertJsonPath('move_results.0.from.category', 'in_progress')
        ->assertJsonPath('move_results.0.to.id', $done->id)
        ->assertJsonPath('move_results.0.error', null);

    expect($this->task->refresh()->status_id)->toBe($done->id);
    $sentAt = DailyReport::query()->sole()->submitted_at;

    $this->travelTo(CarbonImmutable::parse('2026-10-07 23:58', 'Asia/Jakarta'));
    $this->postJson('/api/v1/laporan/hari-ini/kirim', $body)
        ->assertOk()
        ->assertJsonPath('move_results.0.moved', false)
        ->assertJsonPath('move_results.0.from.id', $done->id)
        ->assertJsonPath('move_results.0.error', null);
    expect(DailyReport::query()->sole()->submitted_at?->equalTo($sentAt))->toBeTrue();
});

test('a refused move stores nothing and keeps the task where it was', function () {
    $done = F::status($this->readOnly, Cat::Done);
    Sanctum::actingAs($this->me);

    $this->postJson('/api/v1/laporan/hari-ini/kirim', apiReport(['items' => [
        ['task_id' => $this->locked->id, 'progress_note' => 'Dicek', 'move_status_id' => $done->id],
    ]]))->assertUnprocessable()->assertJsonValidationErrors('items.0.move_status_id');

    expect(DailyReport::query()->count())->toBe(0)
        ->and($this->locked->refresh()->status_category)->toBe(Cat::Todo);
});

test('a report of another date is locked with code laporan_terkunci', function () {
    Sanctum::actingAs($this->me);
    $this->putJson('/api/v1/laporan/hari-ini', apiReport(['summary' => 'Asli']))->assertOk();

    $this->putJson('/api/v1/laporan/hari-ini', apiReport(['report_date' => '2026-10-06']))
        ->assertForbidden()
        ->assertJsonPath('code', 'laporan_terkunci')
        ->assertJsonPath('today', '2026-10-07')
        ->assertJsonStructure(['message', 'errors' => ['report_date']]);

    // After midnight the app still holding the 7th is refused for save and send.
    $this->travelTo(CarbonImmutable::parse('2026-10-08 00:01', 'Asia/Jakarta'));
    $this->putJson('/api/v1/laporan/hari-ini', apiReport(['summary' => 'Terlambat']))
        ->assertForbidden()->assertJsonPath('code', 'laporan_terkunci')->assertJsonPath('report_date', '2026-10-07');
    $this->postJson('/api/v1/laporan/hari-ini/kirim', apiReport(['items' => [['task_id' => null, 'progress_note' => 'x']]]))
        ->assertForbidden()->assertJsonPath('code', 'laporan_terkunci');

    expect(DailyReport::query()->sole()->summary)->toBe('Asli');

    $this->getJson('/api/v1/laporan/hari-ini')
        ->assertOk()->assertJsonPath('date', '2026-10-08')->assertJsonPath('report.status', 'missing');
});

test('task search finds visible tasks by title or key and offers columns only when movable', function () {
    Sanctum::actingAs($this->me);

    $this->getJson('/api/v1/laporan/cari-tugas?q=hanya')
        ->assertOk()->assertJsonPath('tasks.0.key', 'RO-1')->assertJsonPath('tasks.0.can_move', false)->assertJsonPath('tasks.0.statuses', []);
    $this->getJson('/api/v1/laporan/cari-tugas?q=PRJ-1')
        ->assertOk()->assertJsonPath('tasks.0.title', 'Rekap stok gudang')->assertJsonCount(5, 'tasks.0.statuses');
    $this->getJson('/api/v1/laporan/cari-tugas?q=a')->assertOk()->assertJsonCount(0, 'tasks');

    Sanctum::actingAs($this->org['kadiv']);
    $this->getJson('/api/v1/laporan/cari-tugas?q=Rahasia')->assertOk()->assertJsonCount(0, 'tasks');
});

test('the month history lists scheduled days and reports with counts', function () {
    DailyReport::factory()->on('2026-10-05')->create(['user_id' => $this->me->id, 'company_id' => $this->me->company_id, 'submitted_at' => F::at('2026-10-05 17:00')]);
    DailyReport::factory()->draft()->on('2026-10-06')->create(['user_id' => $this->me->id, 'company_id' => $this->me->company_id]);
    // A report on a Sunday (not scheduled) is listed too.
    DailyReport::factory()->on('2026-10-04')->create(['user_id' => $this->me->id, 'company_id' => $this->me->company_id, 'submitted_at' => F::at('2026-10-04 12:00')]);
    Sanctum::actingAs($this->me);

    $response = $this->getJson('/api/v1/laporan?bulan=2026-10')
        ->assertOk()
        ->assertJsonPath('bulan', '2026-10')
        ->assertJsonPath('today', '2026-10-07')
        ->assertJsonPath('bulan_sebelumnya', '2026-09')
        ->assertJsonPath('bulan_berikutnya', null)
        ->assertJsonPath('counts', ['scheduled' => 5, 'submitted' => 2, 'draft' => 1, 'missing' => 2])
        ->assertJsonPath('hari_ini.status', 'missing')
        ->assertJsonPath('days.0.date', '2026-10-07')
        ->assertJsonPath('days.0.is_today', true)
        ->assertJsonPath('days.0.status', 'missing')
        ->assertJsonPath('days.1.status', 'draft')
        ->assertJsonPath('days.1.report.locked', true)
        ->assertJsonPath('days.2.status', 'submitted')
        ->assertJsonPath('days.3.date', '2026-10-04')
        ->assertJsonPath('days.3.scheduled', false);

    expect(collect($response->json('days'))->pluck('date')->all())
        ->toBe(['2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04', '2026-10-02', '2026-10-01']);

    $this->getJson('/api/v1/laporan')->assertOk()->assertJsonPath('bulan', '2026-10');
    $this->getJson('/api/v1/laporan?bulan=2026-09')->assertOk()->assertJsonPath('bulan_berikutnya', '2026-10')->assertJsonPath('counts.scheduled', 22);
    $this->getJson('/api/v1/laporan?bulan=2026-11')->assertUnprocessable()->assertJsonValidationErrors('bulan');
    $this->getJson('/api/v1/laporan?bulan=okt')->assertUnprocessable()->assertJsonValidationErrors('bulan');
});

test('a report detail is readable by the owner and sent ones by readers, titles only when visible', function () {
    Sanctum::actingAs($this->me);
    $this->postJson('/api/v1/laporan/hari-ini/kirim', apiReport(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'Publik'],
        ['task_id' => $this->secret->id, 'progress_note' => 'Privat'],
    ]]))->assertOk();
    $sent = DailyReport::query()->sole();
    $draft = DailyReport::factory()->draft()->on('2026-10-06')->create(['user_id' => $this->me->id, 'company_id' => $this->me->company_id]);

    $this->getJson("/api/v1/laporan/{$sent->id}")
        ->assertOk()
        ->assertJsonPath('mine', true)
        ->assertJsonPath('owner.name', 'Rizky Aditya')
        ->assertJsonPath('report.locked', false)
        ->assertJsonPath('can.edit', true)
        ->assertJsonPath('report.items.1.task_title', 'Rahasia tim');
    $this->getJson("/api/v1/laporan/{$draft->id}")
        ->assertOk()->assertJsonPath('report.status', 'draft')->assertJsonPath('report.locked', true)->assertJsonPath('can.edit', false);

    Sanctum::actingAs($this->org['kadiv']);
    $this->getJson("/api/v1/laporan/{$sent->id}")
        ->assertOk()
        ->assertJsonPath('mine', false)
        ->assertJsonPath('can.edit', false)
        ->assertJsonPath('report.items.0.task_title', 'Rekap stok gudang')
        ->assertJsonPath('report.items.1.task_key', 'PRV-1')
        ->assertJsonPath('report.items.1.task_title', null)
        ->assertJsonPath('report.items.1.task_id', null);
    $this->getJson("/api/v1/laporan/{$draft->id}")->assertNotFound();
    $this->getJson("/api/v1/laporan/orang/{$this->me->id}")
        ->assertOk()->assertJsonPath('mine', false)->assertJsonCount(1, 'reports')->assertJsonPath('reports.0.status', 'submitted');

    Sanctum::actingAs($this->org['budi']);
    $this->getJson("/api/v1/laporan/{$sent->id}")->assertNotFound();
    $this->getJson("/api/v1/laporan/orang/{$this->me->id}")->assertNotFound();
});

test('the team view counts against the schedule and never sends draft content', function () {
    Sanctum::actingAs($this->me);
    $this->postJson('/api/v1/laporan/hari-ini/kirim', apiReport(['items' => [
        ['task_id' => $this->secret->id, 'progress_note' => 'Privat'],
    ]]))->assertOk();
    DailyReport::factory()->draft()->create(['user_id' => $this->org['sari']->id, 'company_id' => $this->me->company_id, 'summary' => 'DRAF RAHASIA SARI']);

    Sanctum::actingAs($this->org['kadiv']);
    $response = $this->getJson('/api/v1/laporan/tim')
        ->assertOk()
        ->assertJsonPath('date', '2026-10-07')
        ->assertJsonPath('is_today', true)
        ->assertJsonPath('totals', ['people' => 2, 'scheduled' => 2, 'reported' => 1, 'draft' => 1, 'missing' => 0])
        ->assertJsonCount(1, 'reports')
        ->assertJsonPath('reports.0.user.name', 'Rizky Aditya')
        ->assertJsonPath('reports.0.items.0.key', 'PRV-1')
        ->assertJsonPath('reports.0.items.0.title', null)
        ->assertJsonPath('missing.0.name', 'Sari Wulandari')
        ->assertJsonPath('missing.0.draft', true);
    expect($response->getContent())->not->toContain('DRAF RAHASIA SARI');

    $this->getJson('/api/v1/laporan/tim?tanggal=2026-10-06')
        ->assertOk()->assertJsonPath('totals.missing', 2)->assertJsonPath('is_today', false);
    $this->getJson('/api/v1/laporan/tim?tanggal=2026-10-08')->assertUnprocessable()->assertJsonValidationErrors('tanggal');
    $this->getJson('/api/v1/laporan/tim?tanggal=2026-02-31')->assertUnprocessable();

    // Direksi reads everyone (the task title follows workspace visibility).
    Sanctum::actingAs($this->org['direksi']);
    $this->getJson('/api/v1/laporan/tim')->assertOk()->assertJsonPath('totals.reported', 1);

    // Staff who read nobody.
    Sanctum::actingAs($this->org['sari']);
    $this->getJson('/api/v1/laporan/tim')->assertForbidden();
});

test('the monitoring detail follows monitorDailyReport and hides titles of unseen tasks', function () {
    Sanctum::actingAs($this->me);
    $this->postJson('/api/v1/laporan/hari-ini/kirim', apiReport(['items' => [
        ['task_id' => $this->task->id, 'progress_note' => 'Publik'],
        ['task_id' => $this->secret->id, 'progress_note' => 'Privat'],
    ]]))->assertOk();
    $sent = DailyReport::query()->sole();
    $draft = DailyReport::factory()->draft()->create(['user_id' => $this->org['sari']->id, 'company_id' => $this->me->company_id]);

    Sanctum::actingAs($this->org['kadiv']);
    $this->getJson("/api/v1/monitoring/laporan/{$sent->id}")
        ->assertOk()
        ->assertJsonPath('report.id', $sent->id)
        ->assertJsonPath('report.user.name', 'Rizky Aditya')
        ->assertJsonPath('report.user.division', 'Operasional')
        ->assertJsonPath('report.notes', 'Notulen rapat pagi.')
        ->assertJsonPath('report.blockers', 'Menunggu data cabang.')
        ->assertJsonPath('report.items.0.title', 'Rekap stok gudang')
        ->assertJsonPath('report.items.1.key', 'PRV-1')
        ->assertJsonPath('report.items.1.title', null)
        ->assertJsonPath('report.items.1.task_id', null);
    $this->getJson("/api/v1/monitoring/laporan/{$draft->id}")->assertNotFound();

    Sanctum::actingAs($this->org['hr']);
    $this->getJson("/api/v1/monitoring/laporan/{$sent->id}")->assertOk();

    Sanctum::actingAs($this->org['budi']);
    $this->getJson("/api/v1/monitoring/laporan/{$sent->id}")->assertNotFound();
    $this->getJson('/api/v1/monitoring/laporan/01J0000000000000000000000X')->assertNotFound();
});

test('report endpoints need a token', function () {
    $this->getJson('/api/v1/laporan/hari-ini')->assertUnauthorized();
    $this->putJson('/api/v1/laporan/hari-ini', apiReport())->assertUnauthorized();
    $this->getJson('/api/v1/laporan/tim')->assertUnauthorized();
});
