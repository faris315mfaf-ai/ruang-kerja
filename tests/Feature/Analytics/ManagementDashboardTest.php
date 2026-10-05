<?php

use App\Domain\Analytics\Queries\ManagementDashboard;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\Company;
use App\Models\Milestone;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
 * Dashboard Manajemen (/manajemen, design MgDashboard). "Today" is Wednesday
 * 7 Oct 2026, 10.00 WIB: mingguan = Mon 28 Sep – Fri 2 Oct, bulanan = Mon
 * 7 Sep – Fri 2 Oct (weeks 37–40). Every expected number is explained next
 * to the data that produces it.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = F::org();
});

/**
 * @return array<string, mixed>
 */
function managementProps(object $test, string $who): array
{
    $props = [];
    $test->actingAs($test->org[$who])->get('/manajemen')
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$props): void {
            $page->loadDeferredProps(function (Assert $reload) use (&$props): void {
                $props = $reload->toArray()['props'];
            });
        });

    return $props;
}

/** Today's schedule & attendance (same picture as HrDashboardTest). */
function seedManagementAttendance(array $org): void
{
    $regular = Shift::factory()->create(['name' => 'Reguler']);

    foreach (['kadiv', 'rizky', 'sari', 'kadivKeu', 'budi'] as $who) {
        ShiftAssignment::factory()->create(['user_id' => $org[$who]->id, 'shift_id' => $regular->id]);
    }

    // Today: Rizky late, Sari on time, Budi sick, Dimas & Lestari not checked in.
    F::day($org['rizky'], '2026-10-07', AttendanceStatus::Late, ['shift_id' => $regular->id, 'late_minutes' => 12, 'check_in_at' => F::at('2026-10-07 08:22')]);
    F::day($org['sari'], '2026-10-07', AttendanceStatus::Present, ['shift_id' => $regular->id, 'check_in_at' => F::at('2026-10-07 07:50')]);
    F::day($org['budi'], '2026-10-07', AttendanceStatus::Sick, ['shift_id' => $regular->id]);

    // Last week (Rizky): present, late, alpha, sick (excused), needs correction with a check-in
    // → scheduled 4 (Mon, Tue, Wed, Fri), attended 3 (present, late, corrected day) = 75%.
    F::day($org['rizky'], '2026-09-28', AttendanceStatus::Present);
    F::day($org['rizky'], '2026-09-29', AttendanceStatus::Late, ['late_minutes' => 5]);
    F::day($org['rizky'], '2026-09-30', AttendanceStatus::Absent);
    F::day($org['rizky'], '2026-10-01', AttendanceStatus::Sick);
    F::day($org['rizky'], '2026-10-02', AttendanceStatus::NeedsCorrection, ['check_in_at' => F::at('2026-10-02 08:00')]);
    // Week 38 (Sari): present → bulanan scheduled 5, attended 4 = 80%.
    F::day($org['sari'], '2026-09-16', AttendanceStatus::Present);
}

/** Tasks in a workspace every viewer may see. */
function seedManagementTasks(array $org): Workspace
{
    $ws = Workspace::factory()->internal()->create(['company_id' => $org['direksi']->company_id]);

    // Due today: done (Rizky), open (Rizky), done early (Budi), canceled (Budi, not counted).
    F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-10-07', 'completed_at' => '2026-10-07 09:00']);
    F::task($ws, Cat::Todo, [$org['rizky']], ['due_date' => '2026-10-07']);
    F::task($ws, Cat::Done, [$org['budi']], ['due_date' => '2026-10-07', 'completed_at' => '2026-10-06 15:00']);
    F::task($ws, Cat::Canceled, [$org['budi']], ['due_date' => '2026-10-07']);
    // Overdue: Thu 1 Oct (Rizky, also last week's open task) and Tue 6 Oct (Sari) → 2, both Operasional.
    F::task($ws, Cat::Todo, [$org['rizky']], ['due_date' => '2026-10-01']);
    F::task($ws, Cat::Todo, [$org['sari']], ['due_date' => '2026-10-06']);
    // Last week: Mon done on time, Wed done a day late.
    F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-09-28', 'completed_at' => '2026-09-28 16:00']);
    F::task($ws, Cat::Done, [$org['budi']], ['due_date' => '2026-09-30', 'completed_at' => '2026-10-01 10:00']);
    // The week before (week 39): done on time.
    F::task($ws, Cat::Done, [$org['sari']], ['due_date' => '2026-09-22', 'completed_at' => '2026-09-22 10:00']);

    return $ws;
}

it('opens the dashboard for Direksi, HR and Super Admin only', function (string $who, int $status) {
    $this->actingAs($this->org[$who])->get('/manajemen')->assertStatus($status);
})->with([
    'direksi' => ['direksi', 200],
    'hr' => ['hr', 200],
    'super admin' => ['admin', 200],
    'kepala divisi' => ['kadiv', 403],
    'anggota' => ['rizky', 403],
]);

it('redirects guests and refuses deactivated accounts', function () {
    $this->get('/manajemen')->assertRedirect('/login');

    $direksi = $this->org['direksi'];
    $direksi->forceFill(['status' => UserStatus::Inactive])->save();

    expect(Gate::forUser($direksi)->allows('viewManagementDashboard'))->toBeFalse();
});

it('renders the header first and defers the heavy blocks', function () {
    Company::query()->whereKey($this->org['direksi']->company_id)->update(['name' => 'PT Sinar Prima Karya Digital']);

    $this->actingAs($this->org['direksi'])->get('/manajemen')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('manajemen/dashboard')
            ->where('company', 'SPKD')
            ->where('today', '2026-10-07')
            ->where('can', ['portfolio' => true])
            ->where('agenda', [])
            ->where('notes', [])
            ->missing('summary')
            ->missing('portfolio')
            ->loadDeferredProps(['summary', 'portfolio'], fn (Assert $reload) => $reload
                ->has('summary.periods', 3)
                ->has('summary.periods.harian')
                ->has('summary.periods.mingguan')
                ->has('summary.periods.bulanan')
                ->has('summary.attendance.counts')
                ->has('summary.generated_at')
                ->has('portfolio.projects')
                ->has('portfolio.milestones.items')
                ->has('portfolio.attention')));
});

it('derives the company short name', function (string $name, string $short) {
    expect(ManagementDashboard::shortName($name))->toBe($short);
})->with([
    ['PT Sinar Prima Karya Digital', 'SPKD'],
    ['PT Sistem Pelayanan Kesehatan dan Data', 'SPKD'],
    ['CV Maju Jaya', 'Maju Jaya'],
    ['RuangKerja', 'RuangKerja'],
    ['PT. Bank Rakyat Indonesia (Persero) Tbk', 'BRI'],
]);

it('picks today, the last full work week and the last four work weeks', function (string $now, array $expected) {
    $periods = ManagementDashboard::periods(CarbonImmutable::parse($now, 'Asia/Jakarta'));

    expect(array_map(fn ($period) => [$period->startDate(), $period->lastDate()], $periods))->toBe($expected);
})->with([
    'wednesday' => ['2026-10-07 10:00', ['harian' => ['2026-10-07', '2026-10-07'], 'mingguan' => ['2026-09-28', '2026-10-02'], 'bulanan' => ['2026-09-07', '2026-10-02']]],
    'monday' => ['2026-10-05 08:00', ['harian' => ['2026-10-05', '2026-10-05'], 'mingguan' => ['2026-09-28', '2026-10-02'], 'bulanan' => ['2026-09-07', '2026-10-02']]],
    'saturday' => ['2026-10-10 09:00', ['harian' => ['2026-10-10', '2026-10-10'], 'mingguan' => ['2026-10-05', '2026-10-09'], 'bulanan' => ['2026-09-14', '2026-10-09']]],
    'sunday late evening' => ['2026-10-11 23:30', ['harian' => ['2026-10-11', '2026-10-11'], 'mingguan' => ['2026-10-05', '2026-10-09'], 'bulanan' => ['2026-09-14', '2026-10-09']]],
]);

it('computes the daily KPIs and the per-division chart from the metric definitions', function () {
    seedManagementAttendance($this->org);
    seedManagementTasks($this->org);

    $props = managementProps($this, 'direksi');
    $day = $props['summary']['periods']['harian'];

    // 5 scheduled; Rizky (late) + Sari present = 2 → 40%; Dimas & Lestari not checked in.
    expect($day['attendance'])->toEqual(['kind' => 'today', 'present' => 2, 'scheduled' => 5, 'rate' => 40.0, 'late' => 1, 'not_checked_in' => 2])
        // Due today: 3 (canceled left out), 2 done.
        ->and($day['tasks'])->toEqual(['done' => 2, 'planned' => 3, 'rate' => 67.0])
        ->and($day['overdue'])->toBe(['count' => 2, 'top_division' => ['name' => 'Operasional', 'count' => 2]])
        ->and($day['on_time'])->toBeNull()
        ->and($day['range'])->toBe(['from' => '2026-10-07', 'to' => '2026-10-07', 'label' => '7 Okt 2026'])
        // Busiest division first.
        ->and(array_map(fn (array $column) => [$column['label'], $column['planned'], $column['done']], $day['chart']))
        ->toBe([['Operasional', 2, 1], ['Keuangan', 1, 1]]);

    expect($props['summary']['attendance']['counts'])->toBe(['scheduled' => 5, 'present' => 2, 'on_time' => 1, 'late' => 1, 'away' => 1, 'not_checked_in' => 2, 'absent' => 0])
        ->and($props['summary']['attendance']['divisions'])->toBe([
            ['id' => $this->org['keu']->id, 'name' => 'Keuangan', 'scheduled' => 2, 'present' => 0],
            ['id' => $this->org['ops']->id, 'name' => 'Operasional', 'scheduled' => 3, 'present' => 2],
        ]);
});

it('computes the weekly KPIs per weekday with the on-time delta to the week before', function () {
    seedManagementAttendance($this->org);
    seedManagementTasks($this->org);

    $week = managementProps($this, 'direksi')['summary']['periods']['mingguan'];

    expect($week['range'])->toBe(['from' => '2026-09-28', 'to' => '2026-10-02', 'label' => '28 Sep – 2 Okt 2026'])
        ->and($week['attendance'])->toEqual(['kind' => 'average', 'attended' => 3, 'scheduled' => 4, 'rate' => 75.0])
        // Due last week: Mon (done), Wed (done), Thu (open) → 2 of 3.
        ->and($week['tasks'])->toEqual(['done' => 2, 'planned' => 3, 'rate' => 67.0])
        ->and($week['overdue'])->toBeNull()
        // Completed last week: 1 of 2 on time = 50%; the week before 1 of 1 = 100% → −50 points.
        ->and($week['on_time']['value'])->toEqual(50.0)
        ->and($week['on_time']['previous'])->toEqual(100.0)
        ->and($week['on_time']['delta'])->toEqual(-50.0)
        ->and($week['on_time']['previous_range']['label'])->toBe('21–25 Sep 2026')
        ->and(array_map(fn (array $column) => [$column['label'], $column['planned'], $column['done']], $week['chart']))
        ->toBe([['Sen 28', 1, 1], ['Sel 29', 0, 0], ['Rab 30', 1, 1], ['Kam 1', 1, 0], ['Jum 2', 0, 0]])
        ->and($week['chart'][0]['full_label'])->toBe('Senin, 28 Sep 2026');
});

it('computes the monthly KPIs per week as the sum of the weekly buckets', function () {
    seedManagementAttendance($this->org);
    seedManagementTasks($this->org);

    $month = managementProps($this, 'direksi')['summary']['periods']['bulanan'];

    expect($month['range']['label'])->toBe('7 Sep – 2 Okt 2026')
        ->and($month['attendance'])->toEqual(['kind' => 'average', 'attended' => 4, 'scheduled' => 5, 'rate' => 80.0])
        ->and($month['tasks'])->toEqual(['done' => 3, 'planned' => 4, 'rate' => 75.0])
        // 2 of 3 on time; nothing completed in the 4 weeks before → no delta.
        ->and($month['on_time']['value'])->toEqual(67.0)
        ->and($month['on_time']['previous'])->toBeNull()
        ->and($month['on_time']['delta'])->toBeNull()
        ->and(array_map(fn (array $column) => [$column['label'], $column['planned'], $column['done']], $month['chart']))
        ->toBe([['Mg 37', 0, 0], ['Mg 38', 0, 0], ['Mg 39', 1, 1], ['Mg 40', 3, 2]]);

    // Chart columns add up to the KPI.
    expect(array_sum(array_column($month['chart'], 'planned')))->toBe($month['tasks']['planned']);
});

it('returns empty, well-formed blocks when there is no data', function () {
    $props = managementProps($this, 'admin');

    expect($props['summary']['periods']['harian']['chart'])->toBe([])
        ->and($props['summary']['periods']['harian']['tasks'])->toBe(['done' => 0, 'planned' => 0, 'rate' => null])
        ->and($props['summary']['periods']['mingguan']['attendance']['rate'])->toBeNull()
        ->and($props['portfolio']['projects'])->toBe([])
        ->and($props['portfolio']['attention'])->toBe(['count' => 0, 'items' => []])
        ->and($props['portfolio']['milestones']['total'])->toBe(0);
});

it('tracks active projects, needs-attention and this month\'s milestones', function () {
    $owner = $this->org['kadiv'];
    $plq = makeProject($owner, ['key' => 'PLQ', 'name' => 'Peluncuran Q4', 'health' => ProjectHealth::AtRisk, 'last_update_at' => now(), 'lead_user_id' => $owner->id, 'division_id' => $this->org['ops']->id, 'color' => 'violet']);
    $ktr = makeProject($owner, ['key' => 'KTR', 'name' => 'Renovasi kantor', 'health' => ProjectHealth::OnTrack, 'last_update_at' => now(), 'target_date' => '2026-11-30']);
    $aud = makeProject($owner, ['key' => 'AUD', 'name' => 'Audit internal', 'health' => ProjectHealth::OnTrack, 'last_update_at' => now(), 'target_date' => '2026-12-15']);
    $irk = makeProject($owner, ['key' => 'IRK', 'name' => 'Intranet', 'project_status' => ProjectStatus::Completed, 'completed_at' => now()]);
    makeProject($owner, ['key' => 'OLD', 'name' => 'Arsip', 'archived_at' => now(), 'last_update_at' => now()]);
    projectTasks($plq, 'done', 1);
    projectTasks($plq, 'todo', 3);

    Milestone::factory()->for($irk, 'workspace')->completed(F::at('2026-10-01 12:00')->toIso8601String())->create(['name' => 'Rilis intranet', 'target_date' => '2026-10-01']);
    Milestone::factory()->for($ktr, 'workspace')->create(['name' => 'Bongkar plafon', 'target_date' => '2026-10-02']);
    Milestone::factory()->for($plq, 'workspace')->create(['name' => 'Siaran pers', 'target_date' => '2026-10-09']);
    Milestone::factory()->for($aud, 'workspace')->create(['name' => 'Laporan audit', 'target_date' => '2026-10-19']);
    Milestone::factory()->for($aud, 'workspace')->create(['name' => 'Tindak lanjut', 'target_date' => '2026-11-04']);

    $portfolio = managementProps($this, 'direksi')['portfolio'];

    expect($portfolio['total'])->toBe(3)
        // At risk first, then on track by target date; completed & archived projects are not tracked.
        ->and(array_column($portfolio['projects'], 'key'))->toBe(['PLQ', 'KTR', 'AUD'])
        ->and($portfolio['projects'][0])->toMatchArray([
            'url' => '/w/PLQ/ringkasan',
            'division' => 'Operasional',
            'lead' => 'Dimas Pratama',
            'health' => 'at_risk',
            'color' => 'violet',
            'actual' => 25.0,
            'attention' => true,
            'milestone' => ['name' => 'Siaran pers', 'target_date' => '2026-10-09', 'missed' => false, 'days_left' => 2],
        ])
        ->and($portfolio['projects'][1]['milestone'])->toBe(['name' => 'Bongkar plafon', 'target_date' => '2026-10-02', 'missed' => true, 'days_left' => -5])
        ->and($portfolio['projects'][1]['flags'])->toBe(['missed_milestone'])
        ->and($portfolio['projects'][2]['attention'])->toBeFalse()
        ->and($portfolio['attention'])->toBe(['count' => 2, 'items' => [
            ['key' => 'PLQ', 'name' => 'Peluncuran Q4', 'reason' => 'berisiko'],
            ['key' => 'KTR', 'name' => 'Renovasi kantor', 'reason' => 'milestone terlewat'],
        ]]);

    $milestones = $portfolio['milestones'];
    expect($milestones['month'])->toBe('Oktober')
        ->and($milestones['done'])->toBe(1)
        ->and($milestones['total'])->toBe(4)
        ->and(array_map(fn (array $item) => [$item['project']['key'], $item['name'], $item['state']], $milestones['items']))
        ->toBe([
            ['IRK', 'Rilis intranet', 'done'],
            ['KTR', 'Bongkar plafon', 'missed'],
            ['PLQ', 'Siaran pers', 'next'],
            ['AUD', 'Laporan audit', 'todo'],
        ]);
});

it('links to the portfolio only for those who may open it', function () {
    $this->actingAs($this->org['hr'])->get('/manajemen')
        ->assertInertia(fn (Assert $page) => $page->where('can', ['portfolio' => false]));
    $this->actingAs($this->org['hr'])->get('/portofolio')->assertForbidden();
    $this->actingAs($this->org['admin'])->get('/manajemen')
        ->assertInertia(fn (Assert $page) => $page->where('can', ['portfolio' => true]));
});

it('limits projects and milestones to the viewer\'s portfolio scope', function () {
    $owner = $this->org['kadiv'];
    $plq = makeProject($owner, ['key' => 'PLQ', 'last_update_at' => now()]);
    $aud = makeProject($owner, ['key' => 'AUD', 'last_update_at' => now()]);
    Milestone::factory()->for($plq, 'workspace')->create(['target_date' => '2026-10-20']);
    Milestone::factory()->for($aud, 'workspace')->create(['target_date' => '2026-10-21']);

    // HR has no portfolio.view: only projects they belong to.
    addMember($aud, $this->org['hr']);

    $hr = managementProps($this, 'hr')['portfolio'];
    expect(array_column($hr['projects'], 'key'))->toBe(['AUD'])
        ->and(array_map(fn (array $item) => $item['project']['key'], $hr['milestones']['items']))->toBe(['AUD']);

    $direksi = managementProps($this, 'direksi')['portfolio'];
    expect(array_column($direksi['projects'], 'key'))->toEqualCanonicalizing(['PLQ', 'AUD']);
});

it('counts tasks only from workspaces the viewer may see', function () {
    $private = Workspace::factory()->create(['company_id' => $this->org['hr']->company_id]);
    F::task($private, Cat::Todo, [$this->org['rizky']], ['due_date' => '2026-10-07']);

    // Direksi sees every non-personal workspace; HR is not a member of this private one.
    expect(managementProps($this, 'direksi')['summary']['periods']['harian']['tasks']['planned'])->toBe(1)
        ->and(managementProps($this, 'hr')['summary']['periods']['harian']['tasks']['planned'])->toBe(0);
});

it('caches the blocks for 5 minutes per viewer', function () {
    $ws = Workspace::factory()->internal()->create(['company_id' => $this->org['direksi']->company_id]);
    F::task($ws, Cat::Todo, [$this->org['rizky']], ['due_date' => '2026-10-07']);
    $planned = fn (string $who): int => managementProps($this, $who)['summary']['periods']['harian']['tasks']['planned'];

    expect($planned('direksi'))->toBe(1);

    F::task($ws, Cat::Todo, [$this->org['rizky']], ['due_date' => '2026-10-07']);
    expect($planned('direksi'))->toBe(1) // cached
        ->and($planned('admin'))->toBe(2); // another viewer, own entry

    $this->travel(6)->minutes();
    expect($planned('direksi'))->toBe(2);
});
