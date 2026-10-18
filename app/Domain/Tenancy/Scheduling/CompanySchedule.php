<?php

namespace App\Domain\Tenancy\Scheduling;

use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Support\OfficeTimezone;
use App\Models\Company;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Daily scheduled work at local office times, per company (Fase 1 multi-
 * perusahaan, Langkah 2b; docs/ARCHITECTURE.md §3.9).
 *
 * routes/console.php registers each task here and schedules it every five
 * minutes (`Schedule::call($task)`); runDue() then, for every company:
 *
 * 1. takes the company's local time (companies.timezone);
 * 2. skips it unless the task is due (LocalTask::dueTarget: today's local
 *    time, or yesterday's while a catch-up window crosses midnight);
 * 3. claims (task, company, target local date) in `scheduled_runs` — an atomic
 *    INSERT … ON CONFLICT DO NOTHING, so overlapping runs or several servers
 *    run it once per company and office date;
 * 4. runs the work inside the company's CompanyContext (jobs dispatched there
 *    remember the company, commands only see it). A failure releases the
 *    claim (retried five minutes later) and does not stop the other companies.
 *
 * Singleton: tests read the registered tasks (task()).
 */
final class CompanySchedule
{
    /** Claims older than this are pruned (tenancy:prune-scheduled-runs). */
    public const int KEEP_DAYS = 60;

    /** @var array<string, LocalTask> */
    private array $tasks = [];

    /**
     * @param  Closure(Company, CarbonImmutable): mixed  $work  (company, target local time)
     */
    public function daily(string $name, string $at, Closure $work): LocalTask
    {
        return $this->tasks[$name] = new LocalTask($name, $at, $work);
    }

    public function task(string $name): ?LocalTask
    {
        return $this->tasks[$name] ?? null;
    }

    /**
     * @return array<string, LocalTask>
     */
    public function tasks(): array
    {
        return $this->tasks;
    }

    /**
     * Runs $task for every company where it is due now.
     *
     * @return list<string> ids of the companies it ran for
     */
    public function runDue(LocalTask $task, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $context = app(CompanyContext::class);
        $ran = [];

        foreach (ForEachCompany::companies() as $company) {
            $target = $task->dueTarget($now->setTimezone(OfficeTimezone::of($company)));

            // Claimed for the target's local date (yesterday's when catching up past midnight).
            if ($target === null || ! $this->claim($task, $company, $target->toDateString())) {
                continue;
            }

            try {
                $context->run($company, function () use ($task, $company, $target): void {
                    $task->perform($company, $target);
                });
                $ran[] = $company->id;
            } catch (Throwable $e) {
                $this->release($task, $company, $target->toDateString());
                report($e);
            }
        }

        return $ran;
    }

    /**
     * Deletes claims older than KEEP_DAYS (global, daily).
     */
    public function prune(?CarbonImmutable $now = null): int
    {
        return DB::table('scheduled_runs')
            ->where('local_date', '<', ($now ?? CarbonImmutable::now())->subDays(self::KEEP_DAYS)->toDateString())
            ->delete();
    }

    private function claim(LocalTask $task, Company $company, string $date): bool
    {
        return DB::table('scheduled_runs')->insertOrIgnore([
            'task' => $task->name,
            'company_id' => $company->id,
            'local_date' => $date,
            'ran_at' => now(),
        ]) === 1;
    }

    private function release(LocalTask $task, Company $company, string $date): void
    {
        DB::table('scheduled_runs')
            ->where(['task' => $task->name, 'company_id' => $company->id, 'local_date' => $date])
            ->delete();
    }
}
