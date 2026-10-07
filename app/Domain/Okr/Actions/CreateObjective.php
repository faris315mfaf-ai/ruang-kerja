<?php

namespace App\Domain\Okr\Actions;

use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Models\Division;
use App\Models\Objective;

/**
 * New objective of a division for one quarter (Kepala Divisi / Direksi,
 * ObjectivePolicy::create). Key results are added afterwards.
 */
final class CreateObjective
{
    /**
     * @param  array{quarter: string, title: string, description: string|null, owner_id: string, status: ObjectiveStatus}  $data
     */
    public function handle(Division $division, array $data): Objective
    {
        return Objective::query()->create([
            'company_id' => $division->company_id,
            'division_id' => $division->id,
            'quarter' => $data['quarter'],
            'title' => $data['title'],
            'description' => $data['description'],
            'owner_id' => $data['owner_id'],
            // Closing goes through CloseObjective (sets closed_at).
            'status' => $data['status'] === ObjectiveStatus::Closed ? ObjectiveStatus::Active : $data['status'],
        ]);
    }
}
