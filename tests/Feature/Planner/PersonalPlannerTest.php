<?php

use App\Domain\Planner\Actions\PlanTask;
use App\Domain\Planner\Actions\UnplanTask;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Planner\Queries\PersonalPlanner;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/../../Support/workspace-helpers.php';
require_once __DIR__.'/planner-helpers.php';

/*
 * Wednesday 7 Oct 2026 10.00 WIB: the ISO week runs Mon 5 – Sun 11 Oct.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->lead = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->me = User::factory()->create(['name' => 'Rizky Aditya']);
    $this->ops = Workspace::factory()->ownedBy($this->lead)->create(['key' => 'OPS', 'name' => 'Operasional']);
    addMember($this->ops, $this->me);
    $this->personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->me->id)->firstOrFail();
});

function planner(User $user): array
{
    return app(PersonalPlanner::class)->for($user, CarbonImmutable::now());
}

/**
 * @return list<string>
 */
function laneTitles(array $planner, string $lane): array
{
    return array_column($planner['lanes'][$lane], 'title');
}

it('places assigned and personal tasks automatically by due date', function () {
    // Assigned by myself: never "new", always placed.
    selfTask($this->ops, $this->me, 'Rekap stok', '2026-10-02');
    selfTask($this->ops, $this->me, 'Laporan harian', '2026-10-07');
    selfTask($this->ops, $this->me, 'Landing page', '2026-10-09');
    selfTask($this->ops, $this->me, 'Minggu malam', '2026-10-11');
    selfTask($this->ops, $this->me, 'Senin depan', '2026-10-12');
    selfTask($this->ops, $this->me, 'Tanpa tenggat');
    $this->travel(1)->minutes(); // same due date: oldest first
    app(CreateTask::class)->handle($this->personal, $this->me, ['title' => 'Catatan pribadi']);

    $planner = planner($this->me);

    expect($planner['today'])->toBe('2026-10-07')
        ->and($planner['incoming'])->toBe([])
        ->and(laneTitles($planner, 'today'))->toBe(['Rekap stok', 'Laporan harian'])
        ->and(laneTitles($planner, 'week'))->toBe(['Landing page', 'Minggu malam'])
        ->and(laneTitles($planner, 'later'))->toBe(['Senin depan', 'Tanpa tenggat', 'Catatan pribadi'])
        ->and($planner['counts'])->toBe(['incoming' => 0, 'today' => 2, 'week' => 2, 'later' => 3])
        ->and($planner['progress'])->toBe(['done' => 0, 'total' => 2]);

    $late = $planner['lanes']['today'][0];
    expect($late)->toMatchArray([
        'key' => 'OPS-1',
        'number' => 1,
        'url' => '/w/OPS/tasks/1',
        'workspace' => ['name' => 'Operasional', 'key' => 'OPS', 'type' => $this->ops->type->value],
        'due_date' => '2026-10-02',
        'days_late' => 5,
        'lane' => 'today',
        'auto' => true,
        'carried' => false,
        'done' => false,
        'is_personal' => false,
        'can_complete' => true,
        'completes_to' => 'review',
        'complete_hint' => null,
    ])->and($late['status']['category'])->toBe('todo');

    expect(collect($planner['lanes']['later'])->firstWhere('title', 'Catatan pribadi'))
        ->toMatchArray(['is_personal' => true, 'completes_to' => 'done']);
});

it('lists recent assignments from someone else as new until they are accepted', function () {
    $this->travelTo(CarbonImmutable::parse('2026-09-10 09:00', 'Asia/Jakarta'));
    assignTask($this->ops, $this->lead, $this->me, 'Lama, belum dibuka', '2026-10-07');
    $this->travelTo(CarbonImmutable::parse('2026-10-06 09:00', 'Asia/Jakarta'));
    $first = assignTask($this->ops, $this->lead, $this->me, 'Audit kendaraan', '2026-10-23');
    $this->travelTo(CarbonImmutable::parse('2026-10-07 09:00', 'Asia/Jakarta'));
    assignTask($this->ops, $this->lead, $this->me, 'Rapat pemasok');
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));

    $planner = planner($this->me);

    // Newest assignment first; older than 14 days → placed automatically.
    expect(array_column($planner['incoming'], 'title'))->toBe(['Rapat pemasok', 'Audit kendaraan'])
        ->and($planner['incoming'][1])->toMatchArray([
            'key' => 'OPS-2',
            'assigned_by' => 'Dimas Pratama',
            'due_date' => '2026-10-23',
            'url' => '/w/OPS/tasks/2',
        ])
        ->and($planner['counts']['incoming'])->toBe(2)
        ->and(laneTitles($planner, 'today'))->toBe(['Lama, belum dibuka']);

    // The assigner does not see it as "new" (it is not theirs to accept).
    expect(planner($this->lead)['incoming'])->toBe([]);

    app(PlanTask::class)->handle($this->me, $first, PlanBucket::Today);
    $planner = planner($this->me);

    expect(array_column($planner['incoming'], 'title'))->toBe(['Rapat pemasok'])
        ->and($planner['lanes']['today'][0])->toMatchArray(['title' => 'Audit kendaraan', 'auto' => false]);

    // Back to automatic: stays accepted, lands in its due-date lane.
    app(UnplanTask::class)->handle($this->me, $first);
    $planner = planner($this->me);

    expect(array_column($planner['incoming'], 'title'))->toBe(['Rapat pemasok'])
        ->and(laneTitles($planner, 'later'))->toBe(['Audit kendaraan'])
        ->and($planner['lanes']['later'][0]['auto'])->toBeTrue();
});

it('keeps planned tasks first, in the order the user chose', function () {
    $a = selfTask($this->ops, $this->me, 'A');
    $b = selfTask($this->ops, $this->me, 'B');
    $c = selfTask($this->ops, $this->me, 'C');
    selfTask($this->ops, $this->me, 'Terlambat', '2026-10-01'); // automatic → today, after planned
    $plan = app(PlanTask::class);

    $plan->handle($this->me, $a, PlanBucket::Today);
    $plan->handle($this->me, $b, PlanBucket::Today);
    $plan->handle($this->me, $c, PlanBucket::Today);
    expect(laneTitles(planner($this->me), 'today'))->toBe(['A', 'B', 'C', 'Terlambat']);

    $plan->handle($this->me, $c, PlanBucket::Today, beforeId: $a->id);
    expect(laneTitles(planner($this->me), 'today'))->toBe(['C', 'A', 'B', 'Terlambat']);

    $plan->handle($this->me, $c, PlanBucket::Today, afterId: $a->id);
    expect(laneTitles(planner($this->me), 'today'))->toBe(['A', 'C', 'B', 'Terlambat']);

    // An automatic neighbour is ignored: end of the planned part.
    $plan->handle($this->me, $a, PlanBucket::Week);
    $plan->handle($this->me, $a, PlanBucket::Today, afterId: Task::query()->where('title', 'Terlambat')->value('id'));
    expect(laneTitles(planner($this->me), 'today'))->toBe(['C', 'B', 'A', 'Terlambat']);
});

it('rebalances a lane when the keys collide', function () {
    $a = selfTask($this->ops, $this->me, 'A');
    $b = selfTask($this->ops, $this->me, 'B');
    $c = selfTask($this->ops, $this->me, 'C');
    $plan = app(PlanTask::class);
    $plan->handle($this->me, $a, PlanBucket::Today);
    $plan->handle($this->me, $b, PlanBucket::Today);
    TaskPlan::query()->where('task_id', $b->id)->update(['position' => TaskPlan::query()->where('task_id', $a->id)->value('position')]);

    $plan->handle($this->me, $c, PlanBucket::Today, afterId: $a->id);

    $positions = TaskPlan::query()->where('user_id', $this->me->id)->orderBy('position')->pluck('task_id')->all();
    expect($positions)->toBe([$a->id, $c->id, $b->id])
        ->and(TaskPlan::query()->distinct()->count('position'))->toBe(3);
});

it('carries a today plan from an earlier day', function () {
    $carried = selfTask($this->ops, $this->me, 'Kemarin');
    $week = selfTask($this->ops, $this->me, 'Minggu ini');
    $this->travelTo(CarbonImmutable::parse('2026-10-06 16:00', 'Asia/Jakarta'));
    app(PlanTask::class)->handle($this->me, $carried, PlanBucket::Today);
    app(PlanTask::class)->handle($this->me, $week, PlanBucket::Week);
    expect(planner($this->me)['lanes']['today'][0]['carried'])->toBeFalse();

    $this->travelTo(CarbonImmutable::parse('2026-10-07 08:00', 'Asia/Jakarta'));
    $planner = planner($this->me);

    expect($planner['lanes']['today'][0])->toMatchArray(['title' => 'Kemarin', 'carried' => true, 'auto' => false])
        ->and($planner['lanes']['week'][0])->toMatchArray(['title' => 'Minggu ini', 'carried' => false]);

    // Reordering inside today keeps the original day; moving it in again today does not carry.
    app(PlanTask::class)->handle($this->me, $carried, PlanBucket::Today);
    expect(planner($this->me)['lanes']['today'][0]['carried'])->toBeTrue();
    app(PlanTask::class)->handle($this->me, $carried, PlanBucket::Week);
    app(PlanTask::class)->handle($this->me, $carried, PlanBucket::Today);
    expect(planner($this->me)['lanes']['today'][0]['carried'])->toBeFalse();
});

it('keeps tasks completed today struck through in their lane and counts the progress', function () {
    $tasks = [
        selfTask($this->ops, $this->me, 'Satu', '2026-10-07'),
        selfTask($this->ops, $this->me, 'Dua', '2026-10-06'),
        selfTask($this->ops, $this->me, 'Tiga'),
        selfTask($this->ops, $this->me, 'Kemarin selesai', '2026-10-05'),
    ];
    app(PlanTask::class)->handle($this->me, $tasks[2], PlanBucket::Today);
    $move = app(MoveTask::class);

    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Jakarta'));
    $move->handle($tasks[3], $this->me, statusOf($this->ops, 'done'));
    $this->travelTo(CarbonImmutable::parse('2026-10-07 09:30', 'Asia/Jakarta'));
    $move->handle($tasks[1], $this->me, statusOf($this->ops, 'done'));
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));

    $planner = planner($this->me);

    expect(laneTitles($planner, 'today'))->toBe(['Tiga', 'Satu', 'Dua'])
        ->and($planner['lanes']['today'][2])->toMatchArray(['done' => true, 'can_complete' => false, 'complete_hint' => null])
        ->and($planner['counts']['today'])->toBe(2)
        ->and($planner['progress'])->toBe(['done' => 1, 'total' => 3]);
});

it('never shows other people\'s plans or tasks', function () {
    $colleague = User::factory()->create();
    addMember($this->ops, $colleague);
    $mine = selfTask($this->ops, $this->me, 'Milik saya');
    selfTask($this->ops, $colleague, 'Milik rekan', '2026-10-01');
    $theirPersonal = Workspace::query()->where('type', 'personal')->where('owner_id', $colleague->id)->firstOrFail();
    app(CreateTask::class)->handle($theirPersonal, $colleague, ['title' => 'Catatan rekan']);

    // The colleague's own plan of my task never moves it for me.
    TaskPlan::factory()->for($colleague)->for($mine)->in(PlanBucket::Today)->create();

    // A workspace I left keeps my task_assignees row but is no longer visible.
    $secret = Workspace::factory()->ownedBy($this->lead)->create(['key' => 'RHS']);
    $hidden = selfTask($secret, $this->me, 'Rahasia', '2026-10-01', addAsMember: true);
    DB::table('workspace_members')->where('workspace_id', $secret->id)->where('user_id', $this->me->id)->delete();
    TaskPlan::factory()->for($this->me)->for($hidden)->in(PlanBucket::Today)->create();

    // Archived workspace and canceled task: hidden.
    $archived = Workspace::factory()->ownedBy($this->lead)->archived()->create(['key' => 'ARS']);
    selfTask($archived, $this->me, 'Diarsipkan', addAsMember: true);
    $canceled = selfTask($this->ops, $this->me, 'Dibatalkan');
    $canceled->update(['status_category' => 'canceled', 'canceled_at' => now()]);

    $planner = planner($this->me);
    $titles = collect($planner['lanes'])->flatten(1)->pluck('title')->all();

    expect($titles)->toBe(['Milik saya'])
        ->and($planner['lanes']['later'][0]['auto'])->toBeTrue();

    // The colleague sees their own plan, never my personal notes.
    app(CreateTask::class)->handle($this->personal, $this->me, ['title' => 'Catatan saya']);
    $theirs = collect(planner($colleague)['lanes'])->flatten(1)->pluck('title')->all();
    expect($theirs)->toContain('Milik rekan', 'Catatan rekan')->not->toContain('Catatan saya', 'Milik saya');
});

it('explains why a task cannot be completed from Ruang saya', function () {
    $viewerWs = Workspace::factory()->ownedBy($this->lead)->create(['key' => 'LIH']);
    addMember($viewerWs, $this->me, WorkspaceRole::Viewer);
    $task = app(CreateTask::class)->handle($viewerWs, $this->lead, ['title' => 'Hanya lihat']);
    DB::table('task_assignees')->insert(['task_id' => $task->id, 'user_id' => $this->me->id, 'assigned_at' => now()->subMonth(), 'assigned_by' => $this->lead->id]);

    $review = selfTask($this->ops, $this->me, 'Sudah direview');
    app(MoveTask::class)->handle($review, $this->me, statusOf($this->ops, 'review'));

    $items = collect(planner($this->me)['lanes'])->flatten(1)->keyBy('title');

    expect($items['Hanya lihat'])->toMatchArray(['can_complete' => false, 'completes_to' => null])
        ->and($items['Hanya lihat']['complete_hint'])->toContain('hanya bisa melihat')
        ->and($items['Sudah direview'])->toMatchArray(['can_complete' => true, 'completes_to' => 'done']);
});

it('answers in a fixed number of queries', function () {
    foreach (range(1, 3) as $i) {
        selfTask($this->ops, $this->me, "Tugas {$i}", '2026-10-0'.$i);
        assignTask($this->ops, $this->lead, $this->me, "Baru {$i}");
        app(CreateTask::class)->handle($this->personal, $this->me, ['title' => "Catatan {$i}"]);
    }

    $count = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        planner(User::query()->findOrFail($this->me->id));
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    };

    $before = $count();

    foreach (range(4, 9) as $i) {
        $other = Workspace::factory()->ownedBy($this->lead)->create();
        addMember($other, $this->me);
        $task = selfTask($other, $this->me, "Tugas {$i}", '2026-10-07');
        app(PlanTask::class)->handle($this->me, $task, PlanBucket::Week);
        assignTask($other, $this->lead, $this->me, "Baru {$i}");
        app(CreateTask::class)->handle($this->personal, $this->me, ['title' => "Catatan {$i}"]);
    }

    expect($count())->toBe($before)->and($before)->toBeLessThanOrEqual(8);
});
