<?php

namespace App\Domain\Hiring\Actions;

use App\Models\CandidateChecklistItem;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Ticks / unticks one checklist item and stores its optional note
 * (CandidateChecklistItemPolicy::check: own items only).
 */
final class SetChecklistItem
{
    public function handle(User $actor, CandidateChecklistItem $item, bool $checked, ?string $note): CandidateChecklistItem
    {
        $note = CreateHiringPosition::text($note);

        $item->fill([
            'checked_at' => $checked ? ($item->checked_at ?? CarbonImmutable::now()) : null,
            'checked_by' => $checked ? ($item->checked_by ?? $actor->id) : null,
            'note' => $note === null ? null : mb_substr($note, 0, 2000),
        ])->save();

        return $item;
    }
}
