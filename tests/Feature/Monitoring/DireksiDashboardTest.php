<?php

use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\Company;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Collection;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
 * Dashboard Direksi (keputusan pemilik 6 Okt 2026). "Today" is Wednesday
 * 7 Oct 2026, 10.00 WIB; the week is Mon 5 – Sun 11 Oct. Five people work
 * Mon–Fri (Dimas, Rizky, Sari in Operasional; Lestari, Budi in Keuangan);
 * HR, Direksi and Super Admin have no shift.
 *
 * Reports: Rizky sent today (project task 50% + a personal to-do + work
 * outside a task, with a blocker), Sari has a draft today, Budi sent
 * yesterday on the same project task.
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
    $this->privateTask = F::task($personal, Cat::Todo, [$org['rizky']], ['title' => 'Urusan pribadi rahasia']);

    $this->rizkyReport = DailyReport::factory()->create([
        'company_id' => $org['rizky']->company_id,
        'user_id' => $org['rizky']->id,
        'report_date' => '2026-10-07',
        'summary' => 'Materi peluncuran setengah jadi.',
        'blockers' => 'Menunggu data vendor.',
        'notes' => 'Rapat singkat dengan tim desain.',
        'submitted_at' => F::at('2026-10-07 09:15'),
    ]);
    DailyReportItem::factory()->create(['daily_report_id' => $this->rizkyReport->id, 'task_id' => $this->projectTask->id, 'task_key' => 'PRJ-1', 'task_title' => 'Siapkan materi', 'progress_note' => 'Draf slide', 'percent' => 50, 'hours' => 2, 'position' => 0]);
    DailyReportItem::factory()->create(['daily_report_id' => $this->rizkyReport->id, 'task_id' => $this->privateTask->id, 'task_key' => 'PRB-1', 'task_title' => 'Urusan pribadi rahasia', 'progress_note' => 'Selesai', 'position' => 1]);
    DailyReportItem::factory()->create(['daily_report_id' => $this->rizkyReport->id, 'progress_note' => 'Bantu tim gudang', 'hours' => 1.5, 'position' => 2]);

    DailyReport::factory()->draft()->create(['company_id' => $org['sari']->company_id, 'user_id' => $org['sari']->id, 'report_date' => '2026-10-07']);

    $this->budiReport = DailyReport::factory()->create([
        'company_id' => $org['budi']->company_id,
        'user_id' => $org['budi']->id,
        'report_date' => '2026-10-06',
        'summary' => 'Rekap biaya materi.',
        'submitted_at' => F::at('2026-10-06 16:30'),
    ]);
    DailyReportItem::factory()->create(['daily_report_id' => $this->budiReport->id, 'task_id' => $this->projectTask->id, 'task_key' => 'PRJ-1', 'progress_note' => 'Hitung anggaran', 'percent' => 60, 'hours' => 3, 'position' => 0]);
});

/**
 * @return array<string, mixed>
 */
function direksiProps(object $test, string $who, string $query = ''): array
{
    $props = [];
    $test->actingAs($test->org[$who])->get('/dashboard/direksi'.$query)
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$props): void {
            $page->component('dashboard/direksi')->loadDeferredProps(function (Assert $reload) use (&$props): void {
                $props = $reload->toArray()['props'];
            });
        });

    return $props;
}

it('sends only the monitoring blocks, not the metrics that left the Direksi dashboard', function () {
    $this->actingAs($this->org['direksi'])->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard/direksi')
            ->where('monitoring', ['date' => '2026-10-07', 'week' => '2026-10-05', 'today' => '2026-10-07'])
            ->has('notes')
            ->has('workspaces')
            ->missing('daily')
            ->missing('weekly')
            ->missing('projects')
            ->missing('metrics')
            ->missing('attendance')
            ->missing('recap')
            ->missing('overdue')
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->has('daily')
                ->has('weekly')
                ->has('projects')
                ->missing('metrics')));
});

it('summarizes today\'s daily reports per division with the reports themselves', function () {
    $daily = direksiProps($this, 'direksi')['daily'];

    expect($daily['date'])->toBe('2026-10-07')
        ->and($daily['is_today'])->toBeTrue()
        ->and($daily['totals'])->toBe(['people' => 8, 'scheduled' => 5, 'reported' => 1, 'draft' => 1, 'missing' => 3])
        ->and($daily['divisions'])->toBe([
            ['id' => $this->org['keu']->id, 'name' => 'Keuangan', 'people' => 2, 'scheduled' => 2, 'reported' => 0, 'draft' => 0, 'missing' => 2],
            ['id' => $this->org['ops']->id, 'name' => 'Operasional', 'people' => 3, 'scheduled' => 3, 'reported' => 1, 'draft' => 1, 'missing' => 1],
            ['id' => null, 'name' => 'Tanpa divisi', 'people' => 3, 'scheduled' => 0, 'reported' => 0, 'draft' => 0, 'missing' => 0],
        ])
        ->and(array_column($daily['missing'], 'name'))->toBe(['Budi Keu', 'Dimas Pratama', 'Lestari Keu', 'Sari Wulandari'])
        ->and(array_column($daily['missing'], 'draft'))->toBe([false, false, false, true])
        ->and($daily['reports'])->toHaveCount(1);

    $report = $daily['reports'][0];
    expect($report['user']['name'])->toBe('Rizky Aditya')
        ->and($report['blockers'])->toBe('Menunggu data vendor.')
        ->and($report['items_count'])->toBe(3)
        ->and($report['hours'])->toBe(3.5)
        ->and($report)->not->toHaveKey('notes');

    // Project task: title + link. Personal to-do: key only, never the title. Free work: no key.
    expect($report['items'][0])->toMatchArray(['key' => 'PRJ-1', 'title' => 'Siapkan materi', 'url' => '/w/PRJ/tasks/'.$this->projectTask->number, 'percent' => 50, 'hours' => 2.0])
        ->and($report['items'][1])->toMatchArray(['key' => 'PRB-1', 'title' => null, 'url' => null, 'task_id' => null])
        ->and($report['items'][2])->toMatchArray(['key' => null, 'title' => null, 'progress_note' => 'Bantu tim gudang']);
});

it('picks another day with ?tanggal= and refuses future or malformed dates', function () {
    $daily = direksiProps($this, 'direksi', '?tanggal=2026-10-06')['daily'];

    expect($daily['date'])->toBe('2026-10-06')
        ->and($daily['is_today'])->toBeFalse()
        ->and($daily['totals']['reported'])->toBe(1)
        ->and($daily['reports'][0]['user']['name'])->toBe('Budi Keu');

    expect(direksiProps($this, 'direksi', '?tanggal=2026-10-30')['daily']['date'])->toBe('2026-10-07')
        ->and(direksiProps($this, 'direksi', '?tanggal=2026-02-31')['daily']['date'])->toBe('2026-10-07')
        ->and(direksiProps($this, 'direksi', '?tanggal=kemarin')['daily']['date'])->toBe('2026-10-07');
});

it('builds the weekly matrix, the tasks most worked on and this week\'s blockers', function () {
    $weekly = direksiProps($this, 'direksi')['weekly'];

    expect($weekly['week'])->toBe([
        'start' => '2026-10-05', 'end' => '2026-10-11', 'label' => '5–11 Okt 2026',
        'is_current' => true, 'previous' => '2026-09-28', 'next' => null,
    ])
        ->and(array_column($weekly['days'], 'label'))->toBe(['Sen 5', 'Sel 6', 'Rab 7', 'Kam 8', 'Jum 9', 'Sab 10', 'Min 11'])
        // 5 people × Mon–Wed scheduled so far; Rizky (Wed) and Budi (Tue) reported.
        ->and($weekly['totals'])->toBe(['expected' => 15, 'reported' => 2, 'hours' => 6.5, 'people_reported' => 2]);

    $ops = collect($weekly['divisions'])->firstWhere('name', 'Operasional');
    $rizky = collect($ops['people'])->firstWhere('user.name', 'Rizky Aditya');
    $sari = collect($ops['people'])->firstWhere('user.name', 'Sari Wulandari');

    expect(array_column($rizky['days'], 'state'))->toBe(['missing', 'missing', 'reported', 'future', 'future', 'future', 'future'])
        ->and($rizky['days'][2])->toMatchArray(['items' => 3, 'hours' => 3.5, 'report_id' => $this->rizkyReport->id])
        ->and($rizky['reported_days'])->toBe(1)
        ->and($rizky['scheduled_days'])->toBe(3)
        ->and($sari['days'][2]['state'])->toBe('draft')
        ->and($sari['days'][2]['report_id'])->toBeNull();

    // The personal to-do never shows up for Direksi.
    expect($weekly['top_tasks'])->toHaveCount(1)
        ->and($weekly['top_tasks'][0])->toMatchArray(['key' => 'PRJ-1', 'title' => 'Siapkan materi', 'people' => 2, 'mentions' => 2, 'hours' => 5.0, 'last_percent' => 50])
        ->and($weekly['blockers'])->toHaveCount(1)
        ->and($weekly['blockers'][0])->toMatchArray(['report_id' => $this->rizkyReport->id, 'date' => '2026-10-07', 'text' => 'Menunggu data vendor.']);

    $previous = direksiProps($this, 'direksi', '?minggu=2026-09-30')['weekly'];
    expect($previous['week']['start'])->toBe('2026-09-28')
        ->and($previous['week']['next'])->toBe('2026-10-05')
        ->and($previous['totals']['reported'])->toBe(0)
        ->and($previous['totals']['expected'])->toBe(25);
});

it('tracks each open project with this week\'s reports', function () {
    $projects = direksiProps($this, 'direksi')['projects'];

    expect($projects['total'])->toBe(1)
        ->and($projects['projects'][0])->toMatchArray(['key' => 'PRJ', 'url' => '/w/PRJ/ringkasan'])
        ->and($projects['projects'][0]['week'])->toEqual(['reports' => 2, 'people' => 2, 'tasks' => 1, 'hours' => 5])
        ->and($projects['projects'][0]['metrics'])->toHaveKeys(['actual', 'planned', 'variance', 'flags']);
});

it('lists every shared workspace for quick access, marking the view-only ones', function () {
    $team = Workspace::factory()->create(['company_id' => $this->org['direksi']->company_id, 'key' => 'TIM', 'name' => 'Tim Konten']);
    $list = function (): Collection {
        $workspaces = [];
        $this->actingAs($this->org['direksi'])->get('/dashboard/direksi')
            ->assertInertia(function (Assert $page) use (&$workspaces): void {
                $workspaces = $page->toArray()['props']['workspaces'];
            });

        return collect($workspaces);
    };
    $workspaces = $list();

    expect($workspaces->pluck('key')->all())->toContain('PRJ', 'TIM')
        ->and($workspaces->pluck('type')->unique()->all())->not->toContain('personal')
        ->and($workspaces->firstWhere('key', 'TIM')['view_only'])->toBeTrue()
        ->and($workspaces->firstWhere('key', 'PRJ')['url'])->toBe('/w/PRJ/ringkasan');

    addMember($team, $this->org['direksi']);
    expect($list()->firstWhere('key', 'TIM')['view_only'])->toBeFalse();
});

it('opens the dashboard for Direksi and Super Admin only', function (string $who, int $status) {
    $this->actingAs($this->org[$who])->get('/dashboard/direksi')->assertStatus($status);
})->with([
    ['direksi', 200],
    ['admin', 200],
    ['hr', 403],
    ['kadiv', 403],
    ['rizky', 403],
]);

it('shows the Kepala Divisi today\'s team reports on the division dashboard', function () {
    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('reports.date', '2026-10-07')
            ->where('reports.totals', ['people' => 3, 'scheduled' => 3, 'reported' => 1, 'draft' => 1, 'missing' => 1])
            ->where('reports.missing.0.name', 'Dimas Pratama')
            ->where('reports.missing.1.name', 'Sari Wulandari')
            ->where('reports.missing.1.draft', true)
            ->where('reports.reports.0.id', $this->rizkyReport->id)
            ->where('reports.reports.0.items_count', 3)
            ->where('reports.reports.0.has_blockers', true)
            ->missing('reports.reports.0.items'));

    // Lestari (Keuangan) only sees her division.
    $this->actingAs($this->org['kadivKeu'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page
            ->where('reports.totals.scheduled', 2)
            ->where('reports.totals.reported', 0)
            ->has('reports.reports', 0));
});

it('opens one sent report for those allowed to monitor it', function (string $who, int $status, ?string $title, ?string $private = null) {
    $response = $this->actingAs($this->org[$who])->getJson("/monitoring/laporan/{$this->rizkyReport->id}")->assertStatus($status);

    if ($status === 200) {
        // The task title follows task visibility (Rizky is assigned but not a member of the private project).
        $response->assertJsonPath('report.notes', 'Rapat singkat dengan tim desain.')
            ->assertJsonPath('report.items.0.title', $title)
            // The personal to-do: only its owner reads the title.
            ->assertJsonPath('report.items.1.title', $private);
    }
})->with([
    'direksi' => ['direksi', 200, 'Siapkan materi'],
    'hr' => ['hr', 200, 'Siapkan materi'],
    'super admin' => ['admin', 200, 'Siapkan materi'],
    'kepala divisi (Operasional, pemilik proyek)' => ['kadiv', 200, 'Siapkan materi'],
    'penulis' => ['rizky', 200, null, 'Urusan pribadi rahasia'],
    'kepala divisi lain' => ['kadivKeu', 404, null],
    'rekan kerja' => ['sari', 404, null],
    'anggota divisi lain' => ['budi', 404, null],
]);

it('never opens drafts, other companies\' reports or reports of deactivated viewers', function () {
    $draft = DailyReport::query()->where('user_id', $this->org['sari']->id)->firstOrFail();
    $this->actingAs($this->org['direksi'])->getJson("/monitoring/laporan/{$draft->id}")->assertNotFound();

    $other = Company::factory()->create();
    $outsider = User::factory()->create(['company_id' => $other->id]);
    $foreign = DailyReport::factory()->create(['company_id' => $other->id, 'user_id' => $outsider->id]);
    $this->actingAs($this->org['direksi'])->getJson("/monitoring/laporan/{$foreign->id}")->assertNotFound();

    $this->org['hr']->update(['status' => 'inactive']);
    $response = $this->actingAs($this->org['hr']->fresh())->getJson("/monitoring/laporan/{$this->rizkyReport->id}");
    expect($response->status())->not->toBe(200)
        ->and($response->json('report'))->toBeNull();
});

it('shows a task title in the detail only to readers who may see the task', function () {
    $this->actingAs($this->org['kadivKeu']->fresh())->getJson("/monitoring/laporan/{$this->budiReport->id}")
        ->assertOk()
        // Lestari leads Keuangan (Budi) but is not a member of the private project.
        ->assertJsonPath('report.items.0.key', 'PRJ-1')
        ->assertJsonPath('report.items.0.title', null)
        ->assertJsonPath('report.items.0.url', null);

    expect(Task::query()->whereKey($this->projectTask->id)->exists())->toBeTrue();
});
