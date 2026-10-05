<?php

namespace App\Domain\Organization\Services;

use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Keeps `divisions.head_user_id` / `teams.lead_user_id` consistent with the
 * people behind them: an employee who is deactivated, or who leaves a division
 * or team, stops heading/leading it. Each release writes one audit row
 * (`division.updated` / `team.updated`) with the explicit actor. Call it inside
 * the caller's transaction.
 */
final readonly class LeadershipReleaser
{
    public function __construct(private AuditLogger $audit) {}

    /**
     * Every division and team the user heads/leads (deactivation).
     *
     * @return int number of units released
     */
    public function releaseAll(User $user, User $actor): int
    {
        $user->forgetLedDivisionIds();

        return $this->releaseDivisions(Division::query()->withTrashed()->where('head_user_id', $user->id), $actor)
            + $this->releaseTeams(Team::query()->withTrashed()->where('lead_user_id', $user->id), $actor);
    }

    /**
     * The division and team the user just left (master-data change).
     *
     * @return int number of units released
     */
    public function releaseLeft(User $user, ?string $oldDivisionId, ?string $oldTeamId, User $actor): int
    {
        $user->forgetLedDivisionIds();
        $released = 0;

        if ($oldDivisionId !== null && $oldDivisionId !== $user->division_id) {
            $released += $this->releaseDivisions(
                Division::query()->withTrashed()->whereKey($oldDivisionId)->where('head_user_id', $user->id),
                $actor,
            );
        }

        if ($oldTeamId !== null && $oldTeamId !== $user->team_id) {
            $released += $this->releaseTeams(
                Team::query()->withTrashed()->whereKey($oldTeamId)->where('lead_user_id', $user->id),
                $actor,
            );
        }

        return $released;
    }

    /**
     * @param  Builder<Division>  $query
     */
    private function releaseDivisions(Builder $query, User $actor): int
    {
        $divisions = $query->lockForUpdate()->get();

        foreach ($divisions as $division) {
            $headId = $division->head_user_id;
            $division->head_user_id = null;
            $division->saveQuietly();

            $this->audit->log('division.updated', $division, ['head_user_id' => $headId], ['head_user_id' => null], $actor);
        }

        return $divisions->count();
    }

    /**
     * @param  Builder<Team>  $query
     */
    private function releaseTeams(Builder $query, User $actor): int
    {
        $teams = $query->lockForUpdate()->get();

        foreach ($teams as $team) {
            $leadId = $team->lead_user_id;
            $team->lead_user_id = null;
            $team->saveQuietly();

            $this->audit->log('team.updated', $team, ['lead_user_id' => $leadId], ['lead_user_id' => null], $actor);
        }

        return $teams->count();
    }
}
