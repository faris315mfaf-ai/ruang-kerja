<?php

namespace App\Domain\Automation\Actions;

use App\Models\RecurringTask;

/**
 * Pause / resume (the switch in the list). A paused recurring task creates
 * nothing until it is resumed; dates missed while paused are not caught up.
 */
final class SetRecurringTaskActive
{
    public function handle(RecurringTask $recurring, bool $active): RecurringTask
    {
        $recurring->is_active = $active;
        $recurring->save();

        return $recurring;
    }
}
