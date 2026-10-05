<?php

namespace App\Http\Requests\Concerns;

use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Gate;

/**
 * FormRequest authorization for workspace/task routes: someone who may not see
 * the workspace (or the task's workspace) gets 404 before validation runs, so
 * validation errors never reveal that it exists. The controller still checks
 * the specific ability (update, editTasks, …) afterwards.
 */
trait HidesInvisibleWorkspaces
{
    public function authorize(): bool
    {
        $user = $this->user();
        $workspace = $this->route('workspace');
        $task = $this->route('task');

        $visible = $user instanceof User
            && (! $workspace instanceof Workspace || Gate::forUser($user)->allows('view', $workspace))
            && (! $task instanceof Task || Gate::forUser($user)->allows('view', $task));

        abort_unless($visible, 404);

        return true;
    }
}
