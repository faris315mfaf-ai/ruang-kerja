<?php

namespace App\Domain\Automation\Actions;

use App\Models\TaskTemplate;

/**
 * Deletes a task template. Tasks created from it stay.
 */
final class DeleteTaskTemplate
{
    public function handle(TaskTemplate $template): void
    {
        $template->delete();
    }
}
