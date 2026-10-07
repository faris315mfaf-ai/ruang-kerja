<?php

namespace App\Domain\Okr\Actions;

use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Domain\Okr\Services\ObjectiveHealth;
use App\Models\Objective;

/**
 * Closes an objective at the end of the quarter: read-only from then on, no
 * more check-in reminders. Pending "objective berisiko" claims are released.
 */
final class CloseObjective
{
    public function __construct(private readonly ObjectiveHealth $health) {}

    public function handle(Objective $objective): Objective
    {
        if ($objective->isClosed()) {
            return $objective;
        }

        $objective->forceFill(['status' => ObjectiveStatus::Closed, 'closed_at' => now()])->save();
        $this->health->releaseAtRiskClaims($objective);

        return $objective;
    }
}
