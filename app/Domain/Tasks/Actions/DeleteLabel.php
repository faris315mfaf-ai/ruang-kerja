<?php

namespace App\Domain\Tasks\Actions;

use App\Models\Label;

/**
 * Deletes a label; task_labels rows cascade.
 */
final class DeleteLabel
{
    public function handle(Label $label): void
    {
        $label->delete();
    }
}
