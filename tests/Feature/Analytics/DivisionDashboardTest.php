<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

/*
 * Wednesday 7 Oct 2026 10.00 WIB. "Minggu ini" to date = Mon 5 – Wed 7 Oct,
 * compared with Mon 28 – Wed 30 Sep. Expected numbers are hand-computed.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = $org = F::org();
    $ws = Workspace::factory()->internal()->create();

    // OPS
    F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-10-05', 'completed_at' => '2026-10-05 10:00']); // on time
    F::task($ws, Cat::Todo, [$org['rizky']], ['due_date' => '2026-10-06', 'title' => 'Rekap stok gudang']); // overdue
    F::task($ws, Cat::InProgress, [$org['rizky']], ['due_date' => '2026-10-08', 'estimate_hours' => 3]); // after today
    F::task($ws, Cat::Done, [$org['sari']], ['due_date' => '2026-10-06', 'completed_at' => '2026-10-07 09:00']); // late
    F::task($ws, Cat::Done, [$org['rizky']], ['due_date' => '2026-09-30', 'completed_at' => '2026-09-30 15:00']); // previous, on time
    F::task($ws, Cat::Todo, [$org['sari']], ['due_date' => '2026-10-01']); // overdue
    // KEU
    F::task($ws, Cat::Done, [$org['budi']], ['due_date' => '2026-10-06', 'completed_at' => '2026-10-06 10:00']);
    F::task($ws, Cat::Todo, [$org['budi']], ['due_date' => '2026-10-02', 'title' => 'Tagihan vendor KEU']);

    $shift = Shift::factory()->create(['name' => 'Reguler']);
    foreach ([$org['kadiv'], $org['rizky'], $org['sari'], $org['budi']] as $user) {
        ShiftAssignment::factory()->create(['user_id' => $user->id, 'shift_id' => $shift->id]);
    }
    F::day($org['rizky'], '2026-10-07', AttendanceStatus::Late, ['shift_id' => $shift->id, 'late_minutes' => 24, 'check_in_at' => F::at('2026-10-07 08:34')]);
    F::day($org['sari'], '2026-10-07', AttendanceStatus::Leave, ['shift_id' => $shift->id]);
    F::day($org['budi'], '2026-10-07', AttendanceStatus::Present, ['shift_id' => $shift->id, 'check_in_at' => F::at('2026-10-07 07:50')]);
});

it('shows a Kepala Divisi only their own division, with formula results and deltas', function () {
    $org = $this->org;

    $this->actingAs($org['kadiv'])->get('/dashboard/divisi')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard/division')
            ->where('scope', ['label' => 'Operasional', 'member_count' => 3])
            ->where('filters.periode', 'minggu')
            ->where('filters.divisions', [['id' => $org['ops']->id, 'name' => 'Operasional']])
            ->where('channels', ["division.{$org['ops']->id}.attendance"])
            // Today: Rizky late, Sari on leave, Dimas not checked in; Budi (KEU) absent from the list.
            ->where('attendance.counts.scheduled', 3)
            ->where('attendance.counts.present', 1)
            ->where('attendance.counts.late', 1)
            ->where('attendance.counts.away', 1)
            ->where('attendance.counts.leave', 1)
            ->where('attendance.counts.not_checked_in', 1)
            ->where('attendance.people.0.user.name', 'Rizky Aditya')
            ->where('attendance.people.0.state', 'late')
            ->missing('metrics')
            ->loadDeferredProps(fn (Assert $reload) => $reload
                // Due Mon–Wed: Rizky done, Rizky open, Sari done → 2/3 = 67%; last week Mon–Wed 1/1 → −33 poin.
                ->where('metrics.kpis.completion_rate', ['value' => 67, 'numerator' => 2, 'denominator' => 3, 'previous' => 100, 'delta' => -33])
                // Completed Mon–Wed: Rizky on time, Sari late → 50%; last week 1/1 → −50 poin.
                ->where('metrics.kpis.on_time_rate.value', 50)
                ->where('metrics.kpis.on_time_rate.delta', -50)
                // Rizky (due 6 Oct) + Sari (due 1 Oct), one each; KEU's overdue task never counts.
                ->where('metrics.kpis.overdue_tasks', ['value' => 2, 'people' => 2, 'top_person' => 1])
                ->where('metrics.overdue.total', 2)
                ->where('metrics.overdue.items.0.days_late', 6)
                ->where('metrics.workload.0', fn ($row) => $row['user']['name'] === 'Rizky Aditya' && $row['open'] === 2 && $row['overdue'] === 1 && (float) $row['estimate_hours'] === 3.0)
                ->has('metrics.workload', 3)
                ->has('metrics.trend', 8)
                ->where('metrics.trend.7.value', 67)
                ->where('metrics.trend.6.label', '28 Sep')
                ->where('metrics.compared.current.label', '5–7 Okt 2026')
                ->where('metrics.compared.previous.label', '28–30 Sep 2026')));
});

it('never lets a Kepala Divisi open another division or its teams', function () {
    $org = $this->org;
    $keuTeam = Team::factory()->create(['division_id' => $org['keu']->id]);

    $this->actingAs($org['kadiv'])->get('/dashboard/divisi?divisi='.$org['keu']->id)->assertForbidden();
    $this->actingAs($org['kadiv'])->get('/dashboard/divisi?tim='.$keuTeam->id)->assertForbidden();
    $this->actingAs($org['kadiv'])->get('/dashboard/divisi/ekspor?divisi='.$org['keu']->id)->assertForbidden();
});

it('narrows to a team of the division', function () {
    $org = $this->org;

    $this->actingAs($org['kadiv'])->get('/dashboard/divisi?tim='.$org['gudang']->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('scope', ['label' => 'Operasional · Tim Gudang', 'member_count' => 1])
            ->where('attendance.counts.scheduled', 1)
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('metrics.kpis.overdue_tasks.value', 1)
                ->has('metrics.workload', 1)));
});

it('lets Direksi pick any division, defaulting to the whole company', function () {
    $org = $this->org;

    $this->actingAs($org['direksi'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page
            ->where('scope.label', 'Semua divisi')
            ->where('channels', ['company.attendance'])
            ->has('filters.divisions', 2));

    $this->actingAs($org['direksi'])->get('/dashboard/divisi?divisi='.$org['keu']->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('scope', ['label' => 'Keuangan', 'member_count' => 2])
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('metrics.kpis.completion_rate.value', 100)
                ->where('metrics.kpis.overdue_tasks.value', 1)
                ->where('metrics.overdue.items.0.title', 'Tagihan vendor KEU')));
});

it('compares a custom period with the same number of days before it', function () {
    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi?periode=kustom&dari=2026-10-01&sampai=2026-10-07')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.periode', 'kustom')
            ->loadDeferredProps(fn (Assert $reload) => $reload
                // Due 1–7 Oct: Sari open (1 Oct), Rizky done, Rizky open, Sari done → 2/4.
                ->where('metrics.kpis.completion_rate.value', 50)
                // Due 24–30 Sep: Rizky done → 100%.
                ->where('metrics.kpis.completion_rate.previous', 100)
                ->where('metrics.compared.previous.label', '24–30 Sep 2026')));
});

it('falls back to the default period for malformed filters', function () {
    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi?periode=tahun&dari=kemarin')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.periode', 'minggu'));
});

it('lists the Kepala Divisi approval queue', function () {
    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page->where('approvals', ['count' => 0, 'items' => []]));
});

it('flags project workspaces at risk that involve the division', function () {
    $org = $this->org;
    $risky = Workspace::factory()->project()->withMember($org['rizky'])->create(['name' => 'Peluncuran Q4', 'project_status' => 'active', 'health' => 'at_risk', 'last_update_at' => now()->subDays(2), 'lead_user_id' => $org['rizky']->id]);
    Workspace::factory()->project()->withMember($org['rizky'])->create(['name' => 'Stale', 'project_status' => 'active', 'health' => 'on_track', 'last_update_at' => now()->subDays(9)]);
    Workspace::factory()->project()->withMember($org['rizky'])->create(['name' => 'Fine', 'project_status' => 'active', 'health' => 'on_track', 'last_update_at' => now()->subDay()]);
    Workspace::factory()->project()->withMember($org['budi'])->create(['name' => 'Other division', 'project_status' => 'active', 'health' => 'off_track']);

    $this->actingAs($org['kadiv'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->has('metrics.projects', 2)
            ->where('metrics.projects.0.name', 'Peluncuran Q4')
            ->where('metrics.projects.0.health_label', 'Berisiko')
            ->where('metrics.projects.0.lead', 'Rizky Aditya')
            ->where('metrics.projects.0.url', '/w/'.$risky->key)
            ->where('metrics.projects.1.name', 'Stale')
            ->where('metrics.projects.1.stale', true)));
});

it('does not count tasks in private personal workspaces of members', function () {
    $org = $this->org;
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $org['rizky']->id)->firstOrFail();
    F::task($personal, Cat::Todo, [$org['rizky']], ['due_date' => '2026-10-01', 'title' => 'Pribadi']);

    $this->actingAs($org['kadiv'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('metrics.kpis.overdue_tasks.value', 2)));
});

it('keeps a member without tasks in the workload table', function () {
    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('metrics.workload.2', fn ($row) => $row['user']['name'] === 'Dimas Pratama' && $row['open'] === 0)));
});

it('ignores inactive employees', function () {
    User::factory()->inactive()->inDivision($this->org['ops'])->create();

    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi')
        ->assertInertia(fn (Assert $page) => $page->where('scope.member_count', 3));
});
