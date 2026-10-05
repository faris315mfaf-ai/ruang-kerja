<?php

namespace App\Events\Tasks;

use App\Models\Task;
use App\Models\User;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Domain event (not broadcast): people were added as assignees of a task by
 * $actor. SendTaskAssignedNotifications notifies them; WorkspaceSeeder fakes
 * it so demo data sends nothing.
 */
final class TaskAssigneesAdded implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  list<string>  $userIds
     */
    public function __construct(public Task $task, public User $actor, public array $userIds) {}
}
