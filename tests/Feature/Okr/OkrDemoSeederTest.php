<?php

use App\Domain\Analytics\Okr\ObjectiveProgress;
use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Domain\Okr\Enums\OkrStatus;
use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\Objective;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\OkrDemoSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

it('seeds demo OKR once for the current and previous quarter', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 09:00', 'Asia/Jakarta'));
    $this->seed(DatabaseSeeder::class);
    $this->seed(OkrDemoSeeder::class);

    expect(Objective::query()->where('quarter', '2026-Q4')->where('status', ObjectiveStatus::Active)->count())->toBe(6)
        ->and(Objective::query()->where('quarter', '2026-Q3')->where('status', ObjectiveStatus::Closed)->count())->toBe(3)
        ->and(KeyResult::query()->count())->toBe(21)
        // One check-in on Friday 2 Oct per running key result, 13 weekly ones per Q3 key result.
        ->and(KeyResultCheckin::query()->count())->toBe(15 + 6 * 13)
        ->and(DB::table('key_result_tasks')->count())->toBeGreaterThan(0);

    $statuses = Objective::query()->where('quarter', '2026-Q4')->with('keyResults')->get()
        ->map(fn (Objective $objective) => ObjectiveProgress::summarize(
            array_values($objective->keyResults->map(fn (KeyResult $kr) => $kr->values())->all()),
            Quarter::parse('2026-Q4'),
            CarbonImmutable::parse('2026-10-06'),
        )['status'])
        ->unique()
        ->values()
        ->all();

    expect($statuses)->toContain(OkrStatus::OnTrack)->toContain(OkrStatus::AtRisk)->toContain(OkrStatus::Behind);

    $kadiv = User::query()->where('email', 'kadiv@demo.test')->firstOrFail();
    $programmer = User::query()->where('email', 'programmer@demo.test')->firstOrFail();
    $direksi = User::query()->where('email', 'direksi@demo.test')->firstOrFail();

    expect(Objective::query()->visibleTo($kadiv)->where('quarter', '2026-Q4')->count())->toBe(2)
        ->and(Objective::query()->visibleTo($programmer)->where('quarter', '2026-Q4')->count())->toBe(1)
        ->and(Objective::query()->visibleTo($direksi)->count())->toBe(9);

    // Every linked task is in the objective's division and visible to the key result owner.
    KeyResult::query()->with(['tasks.workspace', 'objective', 'owner'])->get()->each(function (KeyResult $kr) {
        foreach ($kr->tasks as $task) {
            expect(Gate::forUser($kr->owner)->allows('view', $task))->toBeTrue();
        }
    });
});
