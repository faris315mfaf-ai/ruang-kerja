<?php

namespace App\Domain\Projects\Jobs;

use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Queries\ProjectMetrics;
use App\Domain\Projects\Services\ProjectClock;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

/**
 * Daily 23.55 (office time): one burn-up point per open project for the
 * office date (scope = non-canceled tasks, done, and hours when estimated).
 * Idempotent: re-running on the same date overwrites that day's row.
 */
final class TakeProjectProgressSnapshots implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 600;

    public function __construct(public readonly ?string $date = null) {}

    public function handle(ProjectMetrics $metrics): int
    {
        $today = $this->date !== null
            ? CarbonImmutable::parse($this->date, ProjectClock::timezone())->startOfDay()
            : ProjectClock::today();
        $written = 0;

        Workspace::query()
            ->where('type', WorkspaceType::Project->value)
            ->whereNull('archived_at')
            ->where(fn (Builder $query) => $query->whereNull('project_status')->orWhereIn('project_status', ProjectStatus::openValues()))
            ->select('id')
            ->chunkById(200, function (Collection $workspaces) use ($metrics, $today, &$written): void {
                $ids = array_values($workspaces->map(fn (Workspace $workspace): string => $workspace->id)->all());
                $totals = $metrics->taskTotals($ids, $today);
                $now = now();
                $rows = [];

                foreach ($ids as $id) {
                    $total = $totals[$id] ?? null;
                    $rows[] = [
                        'workspace_id' => $id,
                        'date' => $today->toDateString(),
                        'scope_count' => $total->scope ?? 0,
                        'done_count' => $total->done ?? 0,
                        'scope_hours' => $total !== null && $total->estimated > 0 ? round($total->estimatedHours, 2) : null,
                        'done_hours' => $total !== null && $total->estimated > 0 ? round($total->doneEstimatedHours, 2) : null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                DB::table('project_progress_snapshots')->upsert(
                    $rows,
                    ['workspace_id', 'date'],
                    ['scope_count', 'done_count', 'scope_hours', 'done_hours', 'updated_at'],
                );

                $written += count($rows);
            });

        return $written;
    }
}
