<?php

namespace App\Domain\RoleDashboards\Actions;

use App\Domain\Projects\Actions\GiveProjectDirection;
use App\Domain\Projects\Actions\ResolveProjectDecision;
use App\Models\ProjectUpdate;
use App\Models\User;

/**
 * Dirut "Putuskan" on the job dashboard: the decision text (optional) goes to
 * the PIC as a direction on that update (GiveProjectDirection), then the
 * decision is closed (ResolveProjectDecision). Both actions write their own
 * activity, audit row and notification; nothing is duplicated here.
 *
 * Authorization is the caller's (ProjectUpdatePolicy::resolveDecision and,
 * with a text, ProjectDirectionPolicy::create).
 */
final class DecideProjectFromDashboard
{
    public function __construct(
        private readonly GiveProjectDirection $direction,
        private readonly ResolveProjectDecision $resolve,
    ) {}

    public function handle(ProjectUpdate $update, User $actor, ?string $decision = null): ProjectUpdate
    {
        $decision = $decision === null ? null : trim($decision);

        if ($decision !== null && $decision !== '' && $update->hasOpenDecision()) {
            $this->direction->handle($update->workspace, $actor, $decision, $update);
        }

        return $this->resolve->handle($update, $actor);
    }
}
