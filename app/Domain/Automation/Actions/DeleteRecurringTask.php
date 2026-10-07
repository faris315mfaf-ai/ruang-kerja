<?php

namespace App\Domain\Automation\Actions;

use App\Models\RecurringTask;

/**
 * Deletes the schedule. Tasks it already created stay on the board.
 */
final class DeleteRecurringTask
{
    public function handle(RecurringTask $recurring): void
    {
        $recurring->delete();
    }
}
