<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\EmployeeRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Wednesday 7 Oct 2026 10.00 WIB, default period "Bulan ini" to date
 * (1–7 Oct) compared with 1–7 Sep.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = F::org();
    $this->me = $this->org['rizky'];
    $ws = Workspace::factory()->internal()->create(['key' => 'PRJ']);
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->me->id)->firstOrFail();

    F::task($ws, Cat::Todo, [$this->me], ['due_date' => '2026-10-02', 'title' => 'Rekap stok', 'priority' => 2]); // overdue 5 d
    F::task($ws, Cat::Todo, [$this->me], ['due_date' => '2026-10-09', 'title' => 'Landing page']);
    F::task($ws, Cat::InProgress, [$this->me], ['due_date' => '2026-10-07', 'title' => 'Hari ini']);
    F::task($personal, Cat::Todo, [$this->me], ['title' => 'Catatan pribadi']); // no due date
    F::task($ws, Cat::Done, [$this->me], ['due_date' => '2026-10-05', 'completed_at' => '2026-10-05 16:00']); // on time
    F::task($ws, Cat::Done, [$this->me], ['due_date' => '2026-10-01', 'completed_at' => '2026-10-02 09:00']); // late
    F::task($ws, Cat::Done, [$this->me], ['due_date' => '2026-09-03', 'completed_at' => '2026-09-03 09:00']); // previous, on time
    F::task($ws, Cat::Todo, [$this->org['sari']], ['due_date' => '2026-10-01']); // someone else

    F::day($this->me, '2026-10-01', AttendanceStatus::Present);
    F::day($this->me, '2026-10-02', AttendanceStatus::Late, ['late_minutes' => 24]);
    F::day($this->me, '2026-10-05', AttendanceStatus::Present);
    F::day($this->me, '2026-10-06', AttendanceStatus::Wfh);
});

it('shows only my own numbers', function () {
    // "Tugas hari ini" (9 Okt 2026) only counts tasks due TODAY and only in
    // workspaces Rizky is a member of; Ruang saya and its planner are gone.
    addMember(Workspace::query()->where('key', 'PRJ')->firstOrFail(), $this->me);

    $this->actingAs($this->me)->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard/personal')
            ->where('filters.periode', 'bulan')
            ->where('live.profile', ['position' => null, 'manager' => 'Dimas Pratama'])
            // Staff sees no briefing card: briefings arrive in their Inbox.
            ->where('briefing', null)
            ->missing('planner')
            ->missing('dailyReport')
            // Segments: personal note has no due date, only "Hari ini" (due
            // 7 Oct, in_progress) is due today; overdue "Rekap stok" (2 Oct)
            // and Friday's "Landing page" are not part of the card.
            ->where('tugasHariIni.today', '2026-10-07')
            ->where('tugasHariIni.counts', ['pribadi' => 0, 'tim' => 1, 'semua' => 1])
            ->where('tugasHariIni.pribadi', [])
            ->where('tugasHariIni.tim.0.title', 'Hari ini')
            ->where('tugasHariIni.tim.0.key', 'PRJ-3')
            ->where('tugasHariIni.tim.0.workspace.key', 'PRJ')
            ->where('tugasHariIni.tim.0.status.category', 'in_progress')
            ->where('tugasHariIni.tim.0.status.is_done', false)
            ->where('tugasHariIni.tim.0.assignees', ['Rizky Aditya'])
            ->where('tugasHariIni.semua.0.title', 'Hari ini')
            ->missing('live.focus')
            ->missing('live.week')
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('metrics.kpis.open_tasks', ['value' => 4, 'overdue' => 1])
                // Finished 1–7 Oct: 2 (1–7 Sep: 1).
                ->where('metrics.kpis.completed', ['value' => 2, 'numerator' => 2, 'denominator' => 0, 'previous' => 1, 'delta' => 1])
                // 1 of 2 on time; 1–7 Sep 1 of 1 → −50 poin.
                ->where('metrics.kpis.on_time_rate', ['value' => 50, 'numerator' => 1, 'denominator' => 2, 'previous' => 100, 'delta' => -50])
                // Attendance 1–7 Oct: 4 rows, 4 work days, 3 on time → 75%, lateness 24 min.
                ->where('metrics.attendance.days.workdays', 4)
                ->where('metrics.attendance.days.counts', ['present' => 3, 'late' => 1, 'absent' => 0, 'away' => 0])
                ->where('metrics.attendance.attendance_discipline.value', 75)
                ->where('metrics.attendance.average_lateness.value', 24)));
});

it('shows a task assigned a minute ago among today\'s tasks right away', function () {
    // Warm the 5-minute metric cache — "Tugas hari ini" is a live prop.
    $this->actingAs($this->me)->get('/dashboard')->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload->has('metrics')));

    $ws = Workspace::query()->where('key', 'PRJ')->firstOrFail();
    addMember($ws, $this->me);
    F::task($ws, Cat::Todo, [$this->me], ['due_date' => '2026-10-07', 'title' => 'Baru ditugaskan']);
    $this->travel(1)->minutes();

    $this->actingAs($this->me)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
        ->where('tugasHariIni.counts.semua', 2)
        ->where('tugasHariIni.tim.1.title', 'Baru ditugaskan'));
});

it('shows the briefing card to HR, with the open period of 10.00 WIB', function () {
    $this->actingAs($this->org['hr'])->get('/dashboard/saya')
        ->assertInertia(fn (Assert $page) => $page
            ->where('briefing.date', '2026-10-07')
            ->where('briefing.is_recorder', true)
            ->where('briefing.current', 'pagi')
            ->where('briefing.urls.store', '/briefing'));
});

it('shows my leave balance and latest requests', function () {
    // Annual leave balance: not for staff (keputusan pemilik 6 Okt 2026).
    $this->me->assignRole('kepala_divisi');
    $type = LeaveType::factory()->create(['name' => 'Cuti tahunan']);
    LeaveBalance::factory()->create(['user_id' => $this->me->id, 'leave_type_id' => $type->id, 'year' => 2026, 'entitled_days' => 12, 'carried_over_days' => 2, 'used_days' => 4]);
    EmployeeRequest::factory()->status(RequestStatus::Pending)->create(['user_id' => $this->me->id, 'leave_type_id' => $type->id]);
    EmployeeRequest::factory()->create(['user_id' => $this->me->id, 'leave_type_id' => $type->id]); // draft: hidden
    EmployeeRequest::factory()->status(RequestStatus::Pending)->create(['user_id' => $this->org['sari']->id, 'leave_type_id' => $type->id]);

    $this->actingAs($this->me)->get('/dashboard/saya')
        ->assertInertia(fn (Assert $page) => $page
            ->where('live.leave_balance', ['type' => 'Cuti tahunan', 'remaining' => 10, 'year' => 2026])
            ->has('live.requests', 1)
            ->where('live.requests.0.user.id', $this->me->id));
});

it('never sends the annual leave balance to staff', function () {
    $type = LeaveType::factory()->create(['name' => 'Cuti tahunan']);
    LeaveBalance::factory()->create(['user_id' => $this->me->id, 'leave_type_id' => $type->id, 'year' => 2026, 'entitled_days' => 12]);

    expect($this->me->isStaffOnly())->toBeTrue();
    $this->actingAs($this->me)->get('/dashboard/saya')
        ->assertInertia(fn (Assert $page) => $page->where('live.leave_balance', null));
});

it('applies the period filter from the URL', function () {
    $this->actingAs($this->me)->get('/dashboard/saya?periode=minggu')
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.periode', 'minggu')
            ->where('filters.period.from', '2026-10-05')
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('metrics.kpis.completed.value', 1)
                ->where('metrics.compared.previous.label', '28–30 Sep 2026')));
});

it('ignores division filters on the personal dashboard', function () {
    $this->actingAs($this->me)->get('/dashboard/saya?divisi='.$this->org['keu']->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.divisi', null)->where('scope.member_count', 1));
});

it('counts a half-day leave or business trip with a check-in as present, a full-day leave as away', function () {
    F::day($this->me, '2026-10-03', AttendanceStatus::Leave, ['request_portion' => 'half_day', 'check_in_at' => F::at('2026-10-03 12:55')]);
    F::day($this->me, '2026-10-07', AttendanceStatus::BusinessTrip, ['request_portion' => 'full', 'check_in_at' => F::at('2026-10-07 08:00')]);
    F::day($this->me, '2026-10-04', AttendanceStatus::Leave, ['request_portion' => 'full']);

    $this->actingAs($this->me)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
        ->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('metrics.attendance.days.counts', ['present' => 5, 'late' => 1, 'absent' => 0, 'away' => 1])
            ->where('metrics.attendance.days.workdays', 6)));
});
