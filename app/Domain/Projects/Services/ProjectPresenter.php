<?php

namespace App\Domain\Projects\Services;

use App\Domain\Projects\Data\ProjectMetricsData;
use App\Domain\Projects\Enums\ProjectFlag;
use App\Domain\Projects\Queries\ProjectMetrics;
use App\Http\Resources\WorkspaceResource;
use App\Models\User;
use App\Models\Workspace;

/**
 * Shared serializers for the portfolio and the project summary
 * (resources/js/features/portfolio/types.ts).
 */
final class ProjectPresenter
{
    /**
     * @return array{id: string, name: string, avatar: string|null}|null
     */
    public static function person(?User $user): ?array
    {
        return $user === null ? null : ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url];
    }

    /**
     * One project row: reference, people, dates, health and computed metrics.
     *
     * @return array<string, mixed>
     */
    public static function project(Workspace $workspace, ProjectMetricsData $metrics): array
    {
        $next = $metrics->nextMilestone();

        return [
            ...WorkspaceResource::reference($workspace),
            'division' => $workspace->division?->name,
            'lead' => self::person($workspace->lead),
            'sponsor' => self::person($workspace->sponsor),
            'start_date' => $workspace->start_date?->toDateString(),
            'target_date' => $workspace->target_date?->toDateString(),
            'project_status' => ProjectMetrics::status($workspace)->value,
            'health' => $workspace->health?->value,
            'last_update_at' => $workspace->last_update_at?->toIso8601String(),
            'completed_at' => $workspace->completed_at?->toIso8601String(),
            'metrics' => self::metrics($metrics),
            'next_milestone' => $next === null ? null : [
                'id' => $next['id'],
                'name' => $next['name'],
                'target_date' => $next['target_date'],
                'status' => $next['status']->value,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function metrics(ProjectMetricsData $metrics): array
    {
        $missed = $metrics->missedMilestones();

        return [
            'actual' => $metrics->actual,
            'planned' => $metrics->planned,
            'variance' => $metrics->variance,
            'uses_estimates' => $metrics->usesEstimates,
            'flags' => $metrics->flagValues(),
            'overdue' => $metrics->totals->overdue,
            'scope' => $metrics->totals->scope,
            'done' => $metrics->totals->done,
            'update_age_days' => $metrics->updateAgeDays,
            'days_left' => $metrics->daysLeft,
            'milestones_total' => count($metrics->milestones),
            'milestones_done' => $metrics->completedMilestones(),
            'missed_milestones' => array_map(fn (array $milestone): array => [
                'id' => $milestone['id'],
                'name' => $milestone['name'],
                'target_date' => $milestone['target_date'],
            ], $missed),
            'milestones' => array_map(fn (array $milestone): array => [
                'id' => $milestone['id'],
                'name' => $milestone['name'],
                'target_date' => $milestone['target_date'],
                'status' => $milestone['status']->value,
            ], $metrics->milestones),
        ];
    }

    /**
     * Short Indonesian description of the system flags, e.g.
     * "Tertinggal 32 poin · Milestone terlewat · Update 9 hari".
     */
    public static function flagSummary(ProjectMetricsData $metrics): string
    {
        $parts = [];

        foreach ($metrics->flags as $flag) {
            $parts[] = match ($flag) {
                ProjectFlag::Behind => 'Tertinggal '.(int) round(abs((float) $metrics->variance)).' poin',
                ProjectFlag::MissedMilestone => 'Milestone terlewat',
                ProjectFlag::StaleUpdate => $metrics->updateAgeDays === null ? 'Belum ada update' : "Update {$metrics->updateAgeDays} hari",
            };
        }

        return implode(' · ', $parts);
    }
}
