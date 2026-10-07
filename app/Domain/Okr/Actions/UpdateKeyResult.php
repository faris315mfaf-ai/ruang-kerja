<?php

namespace App\Domain\Okr\Actions;

use App\Domain\Okr\Enums\KeyResultUnit;
use App\Domain\Okr\Services\ObjectiveHealth;
use App\Models\KeyResult;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Edits a key result (title, unit, start/target/current, weight, owner). A
 * changed value can drop the objective status → NotifyObjectiveAtRisk.
 *
 * @phpstan-import-type KeyResultData from CreateKeyResult
 */
final class UpdateKeyResult
{
    public function __construct(
        private readonly ObjectiveHealth $health,
        private readonly NotifyObjectiveAtRisk $atRisk,
    ) {}

    /**
     * @param  KeyResultData  $data
     */
    public function handle(KeyResult $keyResult, array $data, ?User $actor = null): KeyResult
    {
        $objective = $keyResult->objective;
        $before = $this->health->statusOf($objective);

        DB::transaction(function () use ($keyResult, $data, $objective): void {
            $keyResult->fill([
                ...$data,
                'unit_label' => $data['unit'] === KeyResultUnit::Number ? $data['unit_label'] : '',
            ])->save();
            $objective->touch();
        });

        $this->atRisk->handle($objective, $before, $actor);

        return $keyResult;
    }
}
