<?php

namespace App\Domain\Automation\Jobs;

use App\Domain\Automation\Actions\CreateTaskFromRecurring;
use App\Domain\Automation\Services\RecurrenceSchedule;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Domain\Tenancy\Scheduling\ForEachCompany;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\RecurringTask;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily 07.00 (office time of each company, CompanySchedule): creates today's task of every active recurring
 * task whose pattern falls on today (RecurrenceSchedule, same rules as the
 * form preview). Idempotent: CreateTaskFromRecurring claims one occurrence
 * row per (recurring task, date). Dates missed while paused or while the job
 * did not run are not caught up.
 */
final class CreateRecurringTasks implements ShouldBeUnique, ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $uniqueFor = 600;

    /** One lock per company (queued per company by CompanySchedule). */
    public function uniqueId(): string
    {
        return $this->companyUniqueId();
    }

    public function handle(CreateTaskFromRecurring $create): int
    {
        if (! (bool) config('features.automation')) {
            return 0;
        }

        return ForEachCompany::sum(fn (): int => $this->create($create));
    }

    private function create(CreateTaskFromRecurring $create): int
    {
        $today = CarbonImmutable::now(CurrentCompany::timezone())->toDateString();
        $created = 0;

        RecurringTask::query()
            ->when(CurrentCompany::id(), fn (Builder $query, string $company) => $query->where('company_id', $company))
            ->where('is_active', true)
            ->where('starts_on', '<=', $today)
            ->where(fn (Builder $query) => $query->whereNull('ends_on')->orWhere('ends_on', '>=', $today))
            ->whereHas('workspace', fn (Builder $workspace) => $workspace->whereNull('archived_at'))
            ->with('workspace')
            ->orderBy('id')
            ->each(function (RecurringTask $recurring) use ($create, $today, &$created): void {
                if (! RecurrenceSchedule::occursOn($recurring->pattern, $recurring->starts_on->toDateString(), $recurring->ends_on?->toDateString(), $today)) {
                    return;
                }

                if ($create->handle($recurring, $today) !== null) {
                    $created++;
                }
            });

        return $created;
    }
}
