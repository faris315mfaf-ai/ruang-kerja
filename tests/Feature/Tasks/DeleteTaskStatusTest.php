<?php

use App\Domain\Tasks\Actions\DeleteTaskStatus;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\Workspace;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Review finding 12: deleting a column checks its tasks inside the transaction,
 * after locking the workspace's columns.
 */

beforeEach(function () {
    $this->workspace = Workspace::factory()->create();
    $this->todo = statusOf($this->workspace, 'todo');
    $this->done = statusOf($this->workspace, 'done');
});

it('locks the columns before checking for tasks', function () {
    $log = [];
    DB::listen(function (QueryExecuted $query) use (&$log): void {
        $log[] = ['sql' => $query->sql, 'level' => DB::transactionLevel()];
    });

    app(DeleteTaskStatus::class)->handle($this->todo, null);

    $lock = collect($log)->search(fn ($q) => str_contains($q['sql'], 'from "task_statuses"') && str_contains($q['sql'], 'for update'));
    $check = collect($log)->search(fn ($q) => str_contains($q['sql'], 'from "tasks"') && str_contains($q['sql'], '"status_id" = ?'));

    expect($lock)->not->toBeFalse()
        ->and($check)->not->toBeFalse()
        ->and($check)->toBeGreaterThan($lock)
        ->and($log[$lock]['level'])->toBeGreaterThanOrEqual(2)
        ->and($log[$check]['level'])->toBe($log[$lock]['level'])
        ->and(TaskStatus::query()->whereKey($this->todo->id)->exists())->toBeFalse();
});

it('moves tasks to the target and refuses the last column or a foreign target', function () {
    $task = Task::factory()->create(['workspace_id' => $this->workspace->id, 'status_id' => $this->todo->id]);
    $foreign = statusOf(Workspace::factory()->create(), 'todo');

    expect(fn () => app(DeleteTaskStatus::class)->handle($this->todo, null))->toThrow(ValidationException::class);
    expect(fn () => app(DeleteTaskStatus::class)->handle($this->todo, $foreign))->toThrow(ValidationException::class);

    app(DeleteTaskStatus::class)->handle($this->todo, $this->done);
    expect($task->refresh()->status_id)->toBe($this->done->id);

    TaskStatus::query()->where('workspace_id', $this->workspace->id)->whereKeyNot($this->done->id)->get()
        ->each(fn (TaskStatus $status) => app(DeleteTaskStatus::class)->handle($status, $this->done));

    expect(fn () => app(DeleteTaskStatus::class)->handle($this->done, null))
        ->toThrow(ValidationException::class, 'Workspace harus punya minimal satu kolom.');
});
