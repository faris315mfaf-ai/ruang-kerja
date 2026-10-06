<?php

namespace App\Domain\Okr\Actions;

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Domain\Okr\Enums\OkrStatus;
use App\Domain\Okr\Notifications\ObjectiveAtRiskNotification;
use App\Domain\Okr\Services\ObjectiveHealth;
use App\Domain\Okr\Services\OkrPeople;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * "Objective berisiko" (okr.objective_at_risk): when a check-in or an edited
 * value makes an active objective's status worse (on track → at risk →
 * behind), its owner and the Kepala Divisi are told — once per status level
 * per quarter (NotificationDispatchLog), never the person who made the
 * change. Back on track releases the claims so a later drop notifies again.
 */
final class NotifyObjectiveAtRisk
{
    public function __construct(
        private readonly OkrPeople $people,
        private readonly ObjectiveHealth $health,
        private readonly NotificationDispatchLog $log,
    ) {}

    /**
     * @return int notifications sent
     */
    public function handle(Objective $objective, OkrStatus $before, ?User $actor = null): int
    {
        if ($objective->status !== ObjectiveStatus::Active) {
            return 0;
        }

        $after = $this->health->statusOf($objective);

        if ($after === OkrStatus::OnTrack) {
            $this->health->releaseAtRiskClaims($objective);

            return 0;
        }

        if ($after->severity() <= $before->severity()) {
            return 0;
        }

        $recipients = $this->people->heads($objective->division)
            ->push($objective->owner)
            ->unique('id')
            ->reject(fn (User $user): bool => $user->id === $actor?->id || ! $user->isActive());
        $sent = 0;

        foreach ($recipients as $user) {
            if (Gate::forUser($user)->denies('view', $objective)) {
                continue;
            }

            if ($this->log->claim($user, NotificationType::OkrObjectiveAtRisk, $objective, "{$objective->quarter}:{$after->value}")) {
                $user->notify(new ObjectiveAtRiskNotification($objective, $after));
                $sent++;
            }
        }

        return $sent;
    }
}
