<?php

namespace App\Domain\Okr\Actions;

use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Models\Objective;

/**
 * Edit title, description, owner, quarter and status (draft ↔ active). Setting
 * a closed objective back to draft/active reopens it.
 */
final class UpdateObjective
{
    /**
     * @param  array{quarter: string, title: string, description: string|null, owner_id: string, status: ObjectiveStatus}  $data
     */
    public function handle(Objective $objective, array $data): Objective
    {
        $status = $data['status'] === ObjectiveStatus::Closed && ! $objective->isClosed()
            ? $objective->status
            : $data['status'];

        $objective->fill([
            'quarter' => $data['quarter'],
            'title' => $data['title'],
            'description' => $data['description'],
            'owner_id' => $data['owner_id'],
            'status' => $status,
            'closed_at' => $status === ObjectiveStatus::Closed ? ($objective->closed_at ?? now()) : null,
        ])->save();

        return $objective;
    }
}
