<?php

use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Tasks\Actions\CreateTask;
use App\Models\TaskPlan;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->workspace = Workspace::query()->where('type', 'personal')->where('owner_id', $this->user->id)->firstOrFail();
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->user, ['title' => 'Catatan']);
});

it('has the documented columns', function () {
    expect(Schema::getColumnListing('task_plans'))->toEqualCanonicalizing([
        'id', 'user_id', 'task_id', 'bucket', 'planned_for', 'position', 'seen_at', 'created_at', 'updated_at',
    ]);

    $position = collect(Schema::getColumns('task_plans'))->firstWhere('name', 'position');
    expect($position['collation'] ?? null)->toBe('C');
});

it('casts the plan and scopes it to its owner', function () {
    $plan = TaskPlan::factory()->for($this->user)->for($this->task)->in(PlanBucket::Week, 'V')->create();
    TaskPlan::factory()->create();

    $fresh = TaskPlan::query()->ownedBy($this->user)->sole();
    expect($fresh->is($plan))->toBeTrue()
        ->and($fresh->bucket)->toBe(PlanBucket::Week)
        ->and($fresh->planned_for?->toDateString())->toBe(now(config('app.office_timezone'))->toDateString())
        ->and($fresh->task->is($this->task))->toBeTrue()
        ->and($fresh->user->is($this->user))->toBeTrue();
});

it('allows one plan per user and task', function () {
    TaskPlan::factory()->for($this->user)->for($this->task)->create();

    expect(fn () => DB::transaction(fn () => TaskPlan::factory()->for($this->user)->for($this->task)->create()))->toThrow(QueryException::class);
});

// Each failing insert runs in its own savepoint so the test transaction stays usable.
it('rejects unknown lanes and positions without a lane', function () {
    expect(fn () => DB::transaction(fn () => DB::table('task_plans')->insert([
        'id' => strtolower((string) str()->ulid()), 'user_id' => $this->user->id, 'task_id' => $this->task->id,
        'bucket' => 'tomorrow', 'position' => 'V', 'created_at' => now(), 'updated_at' => now(),
    ])))->toThrow(QueryException::class);

    expect(fn () => DB::transaction(fn () => DB::table('task_plans')->insert([
        'id' => strtolower((string) str()->ulid()), 'user_id' => $this->user->id, 'task_id' => $this->task->id,
        'bucket' => null, 'position' => 'V', 'created_at' => now(), 'updated_at' => now(),
    ])))->toThrow(QueryException::class);

    TaskPlan::factory()->for($this->user)->for($this->task)->auto()->create();
    expect(TaskPlan::query()->sole()->bucket)->toBeNull();
});

it('disappears with its task', function () {
    TaskPlan::factory()->for($this->user)->for($this->task)->create();
    $this->task->forceDelete();

    expect(TaskPlan::query()->count())->toBe(0);
});

it('rolls the migration back and forth', function () {
    Artisan::call('migrate:rollback', ['--path' => 'database/migrations/2026_10_09_100000_create_task_plans_table.php']);
    expect(Schema::hasTable('task_plans'))->toBeFalse();

    Artisan::call('migrate', ['--path' => 'database/migrations/2026_10_09_100000_create_task_plans_table.php']);
    expect(Schema::hasTable('task_plans'))->toBeTrue();
});
