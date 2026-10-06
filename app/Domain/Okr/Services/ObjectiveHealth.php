<?php

namespace App\Domain\Okr\Services;

use App\Domain\Analytics\Okr\ObjectiveProgress;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Okr\Enums\OkrStatus;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\KeyResult;
use App\Models\Objective;

/**
 * Current computed status of an objective (fresh key result values, office
 * date) and the "objective berisiko" claims that go with it.
 */
final class ObjectiveHealth
{
    public function __construct(private readonly NotificationDispatchLog $log) {}

    public function statusOf(Objective $objective): OkrStatus
    {
        $values = array_values(KeyResult::query()
            ->where('objective_id', $objective->id)
            ->get(['id', 'start_value', 'target_value', 'current_value', 'weight'])
            ->map(fn (KeyResult $kr): array => $kr->values())
            ->all());

        return ObjectiveProgress::summarize($values, $objective->quarterValue(), OfficeTime::today())['status'];
    }

    /**
     * Forgets who was told about this objective's status so a later drop
     * notifies again (back on track, closed).
     */
    public function releaseAtRiskClaims(Objective $objective): void
    {
        $this->log->release(NotificationType::OkrObjectiveAtRisk, $objective->getMorphClass(), [$objective->id]);
    }
}
