<?php

namespace App\Policies;

use App\Models\ChecklistItem;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Checklist lines follow their task (edited from the task detail in Sprint 6).
 */
class ChecklistItemPolicy
{
    public function __construct(private readonly TaskPolicy $tasks) {}

    public function view(User $user, ChecklistItem $item): Response
    {
        return $this->tasks->view($user, $item->task);
    }

    public function update(User $user, ChecklistItem $item): Response
    {
        return $this->tasks->update($user, $item->task);
    }

    public function delete(User $user, ChecklistItem $item): Response
    {
        return $this->tasks->update($user, $item->task);
    }
}
