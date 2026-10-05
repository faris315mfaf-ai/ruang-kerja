<?php

use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\MetricDefinitions\AttendanceDiscipline;
use App\Domain\Analytics\MetricDefinitions\AverageLateness;
use App\Domain\Analytics\MetricDefinitions\CompletionRate;
use App\Domain\Analytics\MetricDefinitions\LeadTimeMedian;
use App\Domain\Analytics\MetricDefinitions\MetricCatalog;
use App\Domain\Analytics\MetricDefinitions\OnTimeRate;
use App\Domain\Analytics\MetricDefinitions\OverdueTasks;
use App\Domain\Analytics\MetricDefinitions\Workload;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Tests\Support\AnalyticsFixtures as F;

/*
 * Every expected number below is computed by hand from the fixture; the
 * comments list which rows count. "Today" is Wednesday 7 Oct 2026 10.00 WIB,
 * the period is the week Mon 5 – Sun 11 Oct, the previous one 28 Sep – 4 Oct.
 */

beforeEach(function () {
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));

    $this->a = User::factory()->create(['name' => 'Ayu']);
    $this->b = User::factory()->create(['name' => 'Bima']);
    $this->c = User::factory()->create(['name' => 'Citra']); // outside the scope

    $this->ws = Workspace::factory()->internal()->create();
    $this->personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->a->id)->firstOrFail(); // auto-created

    $this->team = new MetricScope($this->a, [$this->a->id, $this->b->id]);
    $this->period = Period::resolve(PeriodPreset::Week, null, null, now());
    $this->today = Period::officeDate(now());
});

function seedTasks(object $t): void
{
    $ws = $t->ws;
    // #1 done, due Mon, finished Tue 06.30 WIB (= Mon 23.30 UTC): late by office date.
    F::task($ws, Cat::Done, [$t->a], ['due_date' => '2026-10-05', 'created_at' => '2026-10-01 06:30', 'completed_at' => '2026-10-06 06:30']);
    // #2 done, due Tue, finished Tue 23.30 WIB: on time.
    F::task($ws, Cat::Done, [$t->b], ['due_date' => '2026-10-06', 'created_at' => '2026-10-05 23:30', 'completed_at' => '2026-10-06 23:30']);
    // #3 todo due Thu (open, not late yet), 2.5 h.
    F::task($ws, Cat::Todo, [$t->a], ['due_date' => '2026-10-08', 'estimate_hours' => 2.5]);
    // #4 in progress, two assignees in scope: counted once for rates, for each person in workload; 4 h.
    F::task($ws, Cat::InProgress, [$t->a, $t->b], ['due_date' => '2026-10-09', 'estimate_hours' => 4]);
    // #5 canceled: never counted.
    F::task($ws, Cat::Canceled, [$t->a], ['due_date' => '2026-10-07']);
    // #6 done by someone outside the scope.
    F::task($ws, Cat::Done, [$t->c], ['due_date' => '2026-10-06', 'completed_at' => '2026-10-06 09:00']);
    // #7 todo due after the period.
    F::task($ws, Cat::Todo, [$t->a], ['due_date' => '2026-10-12']);
    // #8 done in A's personal workspace: only on A's own dashboard.
    F::task($t->personal, Cat::Done, [$t->a], ['due_date' => '2026-10-06', 'created_at' => '2026-10-06 08:00', 'completed_at' => '2026-10-06 09:00']);
    // #9 done without assignee.
    F::task($ws, Cat::Done, [], ['due_date' => '2026-10-06', 'completed_at' => '2026-10-06 09:00']);
    // #10 todo due last Sunday: previous period, overdue now.
    F::task($ws, Cat::Todo, [$t->b], ['due_date' => '2026-10-04']);
    // #11 done, due 1 Oct (previous period), finished Mon 08.00: late, completed this week.
    F::task($ws, Cat::Done, [$t->a], ['due_date' => '2026-10-01', 'created_at' => '2026-09-30 08:00', 'completed_at' => '2026-10-05 08:00']);
    // #12 done, due 28 Sep, finished 2 Oct: previous period, late.
    F::task($ws, Cat::Done, [$t->b], ['due_date' => '2026-09-28', 'created_at' => '2026-09-20 08:00', 'completed_at' => '2026-10-02 10:00']);
    // #13 done without due date this week: no on-time verdict.
    F::task($ws, Cat::Done, [$t->a], ['created_at' => '2026-10-06 08:00', 'completed_at' => '2026-10-06 10:00']);
    // #14 done early: due 20 Oct, finished Wed.
    F::task($ws, Cat::Done, [$t->b], ['due_date' => '2026-10-20', 'created_at' => '2026-10-04 09:00', 'completed_at' => '2026-10-07 09:00']);
    // #15 finished exactly at the period end (exclusive).
    F::task($ws, Cat::Done, [$t->a], ['due_date' => '2026-10-12', 'created_at' => '2026-10-01 00:00', 'completed_at' => '2026-10-12 00:00']);
    // #16 finished exactly at the period start (inclusive), due that day.
    F::task($ws, Cat::Done, [$t->b], ['due_date' => '2026-10-05', 'created_at' => '2026-10-03 00:00', 'completed_at' => '2026-10-05 00:00']);
    // #17 in progress, due yesterday: overdue.
    F::task($ws, Cat::InProgress, [$t->a], ['due_date' => '2026-10-06']);
    // #18 review, due today: not overdue yet.
    F::task($ws, Cat::Review, [$t->a], ['due_date' => '2026-10-07']);
    // #19 open personal to-do of A, overdue: only on A's own dashboard.
    F::task($t->personal, Cat::Todo, [$t->a], ['due_date' => '2026-10-01']);
}

it('computes the completion rate per PRD', function () {
    seedTasks($this);
    $metric = new CompletionRate;

    // Due 5–11 Oct, in scope, not canceled: #1 done, #2 done, #3, #4, #16 done, #17, #18 → 3 / 7 = 42,9%.
    $current = $metric->compute($this->team, $this->period);
    expect($current->numerator)->toBe(3.0)->and($current->denominator)->toBe(7.0)->and(round((float) $current->value, 2))->toBe(42.86);

    // Due 28 Sep – 4 Oct: #10 open, #11 done, #12 done → 2 / 3 = 66,7% (shown 67%).
    $previous = $metric->compute($this->team, $this->period->previous());
    expect($previous->numerator)->toBe(2.0)->and($previous->denominator)->toBe(3.0)
        ->and(round((float) $previous->value, 2))->toBe(66.67)
        ->and($current->compareTo($previous))->toMatchArray(['value' => 43.0, 'previous' => 67.0, 'delta' => -24.0]);

    // A's own dashboard: #1 done, #3, #4, #8 done (personal), #17, #18 → 2 / 6.
    $mine = $metric->compute(MetricScope::personal($this->a), $this->period);
    expect([$mine->numerator, $mine->denominator])->toBe([2.0, 6.0]);

    // Series = the same numbers bucketed per week.
    $series = $metric->series($this->team, [$this->period->previous(), $this->period]);
    expect($series[0]->value)->toBe($previous->value)->and($series[1]->value)->toBe($current->value);
});

it('computes the on-time rate in office time per PRD', function () {
    seedTasks($this);
    $metric = new OnTimeRate;

    // Completed 5–11 Oct with a due date, in scope: #1 late (office date!), #2 on time,
    // #11 late, #14 on time, #16 on time (start inclusive). #15 at the end is excluded → 3 / 5.
    $current = $metric->compute($this->team, $this->period);
    expect([$current->numerator, $current->denominator, $current->value])->toBe([3.0, 5.0, 60.0]);

    // Previous week: #12 late → 0 / 1.
    $previous = $metric->compute($this->team, $this->period->previous());
    expect([$previous->numerator, $previous->denominator, $previous->value])->toBe([0.0, 1.0, 0.0])
        ->and($current->deltaFrom($previous))->toBe(60.0);
});

it('counts overdue tasks as open tasks due before today', function () {
    seedTasks($this);

    // #10 (due 4 Oct) and #17 (due 6 Oct); #18 is due today, #5 canceled, #19 personal.
    expect((new OverdueTasks)->compute($this->team, $this->today)->value)->toBe(2.0)
        ->and((new OverdueTasks)->compute(MetricScope::personal($this->a), $this->today)->value)->toBe(2.0); // #17, #19
});

it('computes workload per person including estimated hours', function () {
    seedTasks($this);

    $rows = (new Workload)->compute($this->team, $this->today);

    // A: #3, #4, #7, #17, #18 open (#17 overdue), hours 2,5 + 4. B: #4, #10 (#10 overdue), hours 4.
    expect($rows)->toBe([
        $this->a->id => ['open' => 5, 'overdue' => 1, 'estimate_hours' => 6.5],
        $this->b->id => ['open' => 2, 'overdue' => 1, 'estimate_hours' => 4.0],
    ]);
});

it('computes the median lead time in days', function () {
    seedTasks($this);

    // Completed this week in scope: #1 5 d, #2 1 d, #11 5 d, #13 4 h, #14 3 d, #16 2 d
    // → sorted 0,17 · 1 · 2 · 3 · 5 · 5 → median (2 + 3) / 2 = 2,5 days.
    $value = (new LeadTimeMedian)->compute($this->team, $this->period);
    expect($value->value)->toBe(2.5)->and($value->denominator)->toBe(6.0);
});

it('computes attendance discipline per the DATABASE §10 reference', function () {
    $a = $this->a;
    $b = $this->b;
    F::day($a, '2026-10-05', AttendanceStatus::Present);
    F::day($a, '2026-10-06', AttendanceStatus::Late, ['late_minutes' => 12]);
    F::day($a, '2026-10-07', AttendanceStatus::Wfh);
    F::day($b, '2026-10-05', AttendanceStatus::Leave);
    F::day($b, '2026-10-06', AttendanceStatus::Absent);
    F::day($b, '2026-10-07', AttendanceStatus::NeedsCorrection, ['late_minutes' => 30]);
    F::day($b, '2026-10-11', AttendanceStatus::Present, ['shift_id' => null]); // unscheduled Sunday check-in
    F::day($this->c, '2026-10-05', AttendanceStatus::Present); // outside the scope
    // Previous week.
    F::day($b, '2026-10-04', AttendanceStatus::Present);
    F::day($a, '2026-10-02', AttendanceStatus::EarlyLeave, ['early_leave_minutes' => 20]);
    F::day($a, '2026-09-30', AttendanceStatus::Holiday);

    $metric = new AttendanceDiscipline;
    // Scheduled: A present, late, wfh; B absent, needs_correction (leave excused) → 5; on time: present, wfh → 2.
    $current = $metric->compute($this->team, $this->period);
    expect([$current->numerator, $current->denominator, $current->value])->toBe([2.0, 5.0, 40.0]);

    // Previous: B present, A early leave (holiday excused) → 1 / 2.
    $previous = $metric->compute($this->team, $this->period->previous());
    expect($previous->value)->toBe(50.0)->and($current->deltaFrom($previous))->toBe(-10.0);

    // Average lateness: (12 + 30) / 2 days = 21 minutes.
    $late = (new AverageLateness)->compute($this->team, $this->period);
    expect([$late->numerator, $late->denominator, $late->value])->toBe([42.0, 2.0, 21.0])
        ->and((new AverageLateness)->compute($this->team, $this->period->previous())->value)->toBeNull();
});

it('returns undefined values instead of dividing by zero', function () {
    $scope = new MetricScope($this->a, []);

    expect((new CompletionRate)->compute($scope, $this->period)->value)->toBeNull()
        ->and((new OnTimeRate)->compute($this->team, $this->period)->value)->toBeNull()
        ->and((new LeadTimeMedian)->compute($this->team, $this->period)->value)->toBeNull()
        ->and((new AttendanceDiscipline)->compute($this->team, $this->period)->value)->toBeNull()
        ->and((new MetricValue(null))->compareTo(new MetricValue(50.0)))->toMatchArray(['value' => null, 'previous' => 50.0, 'delta' => null]);
});

it('ignores tasks in workspaces the viewer cannot see', function () {
    $hidden = Workspace::factory()->create(); // private, A is not a member
    F::task($hidden, Cat::Done, [$this->b], ['due_date' => '2026-10-06', 'completed_at' => '2026-10-06 09:00']);
    F::task($this->ws, Cat::Todo, [$this->b], ['due_date' => '2026-10-06']);

    expect((new CompletionRate)->compute($this->team, $this->period)->denominator)->toBe(1.0);
});

it('describes every metric for the tooltips and has no composite score', function () {
    $definitions = MetricCatalog::definitions();

    expect(array_keys($definitions))->toBe([
        'completion_rate', 'on_time_rate', 'overdue_tasks', 'workload', 'lead_time', 'attendance_discipline', 'average_lateness',
    ])->and(collect($definitions)->every(fn (array $d): bool => $d['definition'] !== '' && $d['label'] !== ''))->toBeTrue()
        ->and(implode(' ', array_keys($definitions)))->not->toContain('score');
});
