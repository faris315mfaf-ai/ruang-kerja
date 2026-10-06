<?php

namespace App\Domain\Okr\Actions;

use App\Domain\Okr\Enums\KeyResultUnit;
use App\Models\KeyResult;
use App\Models\Objective;
use Illuminate\Support\Facades\DB;

/**
 * Adds a key result at the end of the objective's list.
 *
 * @phpstan-type KeyResultData array{title: string, unit: KeyResultUnit, unit_label: string, start_value: float, target_value: float, current_value: float, weight: float, owner_id: string}
 */
final class CreateKeyResult
{
    /**
     * @param  KeyResultData  $data
     */
    public function handle(Objective $objective, array $data): KeyResult
    {
        return DB::transaction(function () use ($objective, $data): KeyResult {
            // Serialises concurrent additions so positions stay unique.
            Objective::query()->whereKey($objective->id)->lockForUpdate()->first();
            $position = (int) KeyResult::query()->where('objective_id', $objective->id)->max('position') + 1;

            $keyResult = KeyResult::query()->create([
                ...$data,
                'unit_label' => $data['unit'] === KeyResultUnit::Number ? $data['unit_label'] : '',
                'objective_id' => $objective->id,
                'position' => $position,
            ]);
            $objective->touch();

            return $keyResult;
        });
    }
}
