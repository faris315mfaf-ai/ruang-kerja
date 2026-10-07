<?php

namespace App\Domain\Hiring\Actions;

use App\Models\CandidateChecklistItem;

/**
 * HR removes an unticked checklist item (policy refuses ticked ones).
 */
final class DeleteChecklistItem
{
    public function handle(CandidateChecklistItem $item): void
    {
        $item->delete();
    }
}
