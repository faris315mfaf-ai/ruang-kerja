<?php

use App\Domain\Notifications\Actions\DispatchDueDailyDigests;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Queries\TaskDetail;
use App\Domain\Tasks\Services\TaskAudience;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Comment;
use App\Models\Company;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * N+1 guards: the number of queries must not grow with the number of people.
 */

function countQueries(Closure $callback): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $callback();
    $count = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $count;
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
});

it('checks task audience access with a constant number of queries', function () {
    $few = collect(range(1, 3))->map(fn () => memberWithRole($this->workspace, WorkspaceRole::Member)->id)->all();
    $many = [...$few, ...collect(range(1, 9))->map(fn () => memberWithRole($this->workspace, WorkspaceRole::Member)->id)->all()];
    $outsider = User::factory()->create()->id;
    $audience = app(TaskAudience::class);
    $audience->withAccess($this->workspace->fresh(), [$outsider]); // warm the permission cache

    $small = countQueries(fn () => expect($audience->withAccess($this->workspace->fresh(), [...$few, $outsider]))->toHaveCount(3));
    $large = countQueries(fn () => expect($audience->withAccess($this->workspace->fresh(), [...$many, $outsider]))->toHaveCount(12));

    expect($large)->toBe($small);
});

it('parses task references only in the comments shown in the timeline', function () {
    $task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Induk']);
    $hidden = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Disebut di komentar lama']);
    $shown = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Disebut di komentar baru']);
    $reference = fn ($target) => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'taskReference', 'attrs' => ['id' => $target->id, 'label' => 'X']]]]]];

    Comment::factory()->on($task)->by($this->owner)->create(['body' => $reference($hidden), 'created_at' => now()->subDays(2)]);
    Comment::factory()->on($task)->by($this->owner)->count(TaskDetail::TIMELINE_LIMIT)->create(['created_at' => now()->subDay()]);
    Comment::factory()->on($task)->by($this->owner)->create(['body' => $reference($shown)]);

    $references = app(TaskDetail::class)->for($task, $this->owner)['references'];

    expect(array_keys($references))->toBe([$shown->id]);
});

it('dispatches digests without per-user settings or preference queries', function () {
    Queue::fake();
    // 06.00 WIB on a Monday: nobody is due yet, so every user is only checked.
    $this->travelTo(CarbonImmutable::parse('2026-10-05 06:00', 'Asia/Jakarta'));
    User::factory()->count(3)->create();
    $few = countQueries(fn () => app(DispatchDueDailyDigests::class)->handle(CarbonImmutable::now()));

    User::factory()->count(9)->create();
    $many = countQueries(fn () => app(DispatchDueDailyDigests::class)->handle(CarbonImmutable::now()));

    expect($many)->toBe($few);
});

it('checks task audience access and dispatches digests without per-row queries for another company', function () {
    // Fase 1 multi-perusahaan: rows of a second company must not add queries.
    Queue::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 06:00', 'Asia/Jakarta'));
    $other = Company::factory()->create(['timezone' => 'Asia/Makassar']);
    $members = collect(range(1, 3))->map(fn () => memberWithRole($this->workspace, WorkspaceRole::Member)->id)->all();
    $outsiders = User::factory()->count(3)->forCompany($other)->create()->modelKeys();
    $audience = app(TaskAudience::class);
    $audience->withAccess($this->workspace->fresh(), $outsiders); // warm the permission cache
    app(DispatchDueDailyDigests::class)->handle(CarbonImmutable::now());

    $access = countQueries(fn () => expect($audience->withAccess($this->workspace->fresh(), [...$members, ...$outsiders]))->toHaveCount(3));
    $digests = countQueries(fn () => app(DispatchDueDailyDigests::class)->handle(CarbonImmutable::now()));

    $more = User::factory()->count(9)->forCompany($other)->create()->modelKeys();

    expect(countQueries(fn () => expect($audience->withAccess($this->workspace->fresh(), [...$members, ...$outsiders, ...$more]))->toHaveCount(3)))->toBe($access)
        ->and(countQueries(fn () => app(DispatchDueDailyDigests::class)->handle(CarbonImmutable::now())))->toBe($digests);
});
