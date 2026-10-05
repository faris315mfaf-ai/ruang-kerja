<?php

namespace App\Domain\Projects\Data;

use App\Domain\Analytics\Projects\TaskTotals;
use App\Domain\Projects\Enums\MilestoneStatus;
use App\Domain\Projects\Enums\ProjectFlag;

/**
 * Computed facts of one project (ProjectMetrics::forWorkspaces).
 */
final readonly class ProjectMetricsData
{
    /**
     * @param  list<ProjectFlag>  $flags
     * @param  list<array{id: string, name: string, target_date: string, status: MilestoneStatus, completed_at: string|null, started: bool}>  $milestones
     */
    public function __construct(
        public string $workspaceId,
        public TaskTotals $totals,
        public ?float $actual,
        public ?float $planned,
        public ?float $variance,
        public bool $usesEstimates,
        public array $flags,
        public array $milestones,
        public ?int $updateAgeDays,
        public ?int $daysLeft,
    ) {}

    /**
     * @return list<array{id: string, name: string, target_date: string, status: MilestoneStatus, completed_at: string|null, started: bool}>
     */
    public function missedMilestones(): array
    {
        return array_values(array_filter($this->milestones, fn (array $milestone): bool => $milestone['status'] === MilestoneStatus::Missed));
    }

    /**
     * First milestone that is not done and not missed (by target date).
     *
     * @return array{id: string, name: string, target_date: string, status: MilestoneStatus, completed_at: string|null, started: bool}|null
     */
    public function nextMilestone(): ?array
    {
        foreach ($this->milestones as $milestone) {
            if (! $milestone['status']->isDone() && $milestone['status'] !== MilestoneStatus::Missed) {
                return $milestone;
            }
        }

        return null;
    }

    public function completedMilestones(): int
    {
        return count(array_filter($this->milestones, fn (array $milestone): bool => $milestone['status']->isDone()));
    }

    public function hasFlag(ProjectFlag $flag): bool
    {
        return in_array($flag, $this->flags, true);
    }

    /**
     * @return list<string>
     */
    public function flagValues(): array
    {
        return array_map(fn (ProjectFlag $flag): string => $flag->value, $this->flags);
    }
}
