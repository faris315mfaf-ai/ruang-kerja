<?php

namespace App\Policies;

use App\Models\ChecklistItem;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Checklist lines follow their task (edited from the task detail in Sprint 6).
 * Ticking and editing lines is doing the work (TaskPolicy::work): the
 * assignee of a task someone else assigned may still tick its checklist.
 */
class ChecklistItemPolicy
{
    public function __construct(private readonly TaskPolicy $tasks) {}

    public function view(User $user, ChecklistItem $item): Response
    {
        $task = $item->task;

        return $task === null ? Response::denyAsNotFound() : $this->tasks->view($user, $task);
    }

    public function update(User $user, ChecklistItem $item): Response
    {
        $task = $item->task;

        return $task === null ? Response::denyAsNotFound() : $this->tasks->work($user, $task);
    }

    public function delete(User $user, ChecklistItem $item): Response
    {
        return $this->update($user, $item);
    }
}
