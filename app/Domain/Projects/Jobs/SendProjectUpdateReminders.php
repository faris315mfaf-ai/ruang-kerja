<?php

namespace App\Domain\Projects\Jobs;

use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Notifications\ProjectUpdateReminderNotification;
use App\Domain\Projects\Services\ProjectClock;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\ProjectUpdate;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;

/**
 * Friday 15.00 (office time): reminds the PIC of every running project that
 * has no update since Monday 00.00 of the current week. At most once per
 * project per week, even when the job runs twice.
 */
final class SendProjectUpdateReminders implements ShouldBeUnique, ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $uniqueFor = 600;

    public function handle(): int
    {
        $now = CarbonImmutable::now(ProjectClock::timezone());
        $weekStart = $now->startOfWeek(CarbonImmutable::MONDAY);
        $today = $now->toDateString();
        $sent = 0;

        Workspace::query()
            ->where('type', WorkspaceType::Project->value)
            ->whereNull('archived_at')
            ->whereNotNull('lead_user_id')
            ->where(fn (Builder $query) => $query->whereNull('project_status')->orWhere('project_status', ProjectStatus::Active->value))
            ->where(fn (Builder $query) => $query->whereNull('start_date')->orWhere('start_date', '<=', $today))
            ->whereNotExists(fn ($query) => $query->selectRaw('1')
                ->from((new ProjectUpdate)->getTable())
                ->whereColumn('project_updates.workspace_id', 'workspaces.id')
                ->where('project_updates.created_at', '>=', $weekStart->utc()))
            ->with('lead')
            ->orderBy('id')
            ->each(function (Workspace $workspace) use ($weekStart, &$sent): void {
                $lead = $workspace->lead;

                // A PIC who lost access to the project is not reminded about it.
                if ($lead === null || ! $lead->isActive() || Gate::forUser($lead)->denies('view', $workspace)) {
                    return;
                }

                if (! Cache::add("projects:update-reminder:{$workspace->id}:{$weekStart->toDateString()}", true, now()->addDays(8))) {
                    return;
                }

                $lead->notify(new ProjectUpdateReminderNotification($workspace));
                $sent++;
            });

        return $sent;
    }
}
