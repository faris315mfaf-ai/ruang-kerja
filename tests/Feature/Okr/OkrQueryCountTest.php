<?php

use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\Objective;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/../../Support/okr-helpers.php';

/*
 * The OKR pages must not run more queries when there are more objectives,
 * key results, check-ins and linked tasks (complements PageQueryCountTest,
 * whose generic growth does not add OKR rows).
 */
beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-09 10:00', 'Asia/Jakarta'));
    config(['features.okr' => true]);
    $this->w = okrWorld();
    $this->space = okrDivisionWorkspace($this->w->ops);
});

function growOkr(stdClass $w, Workspace $space, int $objectives): void
{
    foreach (range(1, $objectives) as $i) {
        $objective = $i === 1 ? $w->objective : Objective::factory()->forDivision($w->ops)->ownedBy($w->kadiv)->create();

        foreach ([$w->member, $w->colleague, $w->kadiv] as $owner) {
            $kr = KeyResult::factory()->for($objective)->ownedBy($owner)->values(0, 10, 3)->create();
            KeyResultCheckin::factory()->count(2)->for($kr)->create();
            $tasks = Task::factory()->count(2)->create(['workspace_id' => $space->id]);
            $tasks->each(fn (Task $task) => $task->assignees()->attach($owner->id, ['assigned_at' => now()]));
            $kr->tasks()->attach($tasks->pluck('id')->all());
        }
    }
}

function okrQueries(string $url, User $user): int
{
    Cache::flush();
    DB::flushQueryLog();
    DB::enableQueryLog();
    test()->actingAs($user)->get($url)->assertOk();
    $count = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $count;
}

it('keeps /okr and the detail page constant as OKR data grows', function () {
    $pages = ['/okr' => $this->w->kadiv, '/okr/'.$this->w->objective->id => $this->w->kadiv, '/okr?divisi='.$this->w->ops->id => $this->w->hr];

    growOkr($this->w, $this->space, 2);
    $before = [];

    foreach ($pages as $url => $user) {
        okrQueries($url, $user->fresh());
        $before[$url] = okrQueries($url, $user->fresh());
    }

    growOkr($this->w, $this->space, 4);

    foreach ($pages as $url => $user) {
        expect(okrQueries($url, $user->fresh()))->toBe($before[$url], $url);
    }
});
