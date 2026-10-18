<?php

namespace App\Domain\Tenancy\Scheduling;

use App\Models\Company;
use Carbon\CarbonImmutable;
use Closure;

/**
 * A daily task at a local office time ("00:30", "07:00"), run per company in
 * the company's timezone (CompanySchedule). Due when the company's clock is at
 * or past $at on an accepted day, at most $catchUpMinutes late (a scheduler
 * that was down still catches up, a deploy in the evening does not send the
 * morning reminders again), and not yet claimed for that local date.
 *
 * The catch-up window may cross local midnight: a 23:55 task whose scheduler
 * was down from 23:50 to 00:20 still runs at 00:20 for the previous date
 * (dueTarget() = yesterday 23:55). The claim, the day filter and the work use
 * that target, not the current date.
 *
 * Invokable: the callback of its Schedule::call() event in routes/console.php.
 */
final class LocalTask
{
    public const int CATCH_UP_MINUTES = 120;

    public int $catchUpMinutes = self::CATCH_UP_MINUTES;

    /** @var (Closure(CarbonImmutable): bool)|null */
    private ?Closure $days = null;

    /**
     * @param  Closure(Company, CarbonImmutable): mixed  $work  runs inside the company's CompanyContext;
     *                                                          receives the target local time (dueTarget())
     */
    public function __construct(
        public readonly string $name,
        public readonly string $at,
        private readonly Closure $work,
    ) {}

    public function __invoke(): int
    {
        return count(app(CompanySchedule::class)->runDue($this));
    }

    public function catchUp(int $minutes): self
    {
        $this->catchUpMinutes = $minutes;

        return $this;
    }

    /**
     * @param  Closure(CarbonImmutable): bool  $days  receives the company's local time
     */
    public function on(Closure $days): self
    {
        $this->days = $days;

        return $this;
    }

    public function weekdays(): self
    {
        return $this->on(fn (CarbonImmutable $local): bool => $local->isWeekday());
    }

    /**
     * @param  int  $day  ISO weekday (1 = Monday … 7 = Sunday)
     */
    public function weeklyOn(int $day): self
    {
        return $this->on(fn (CarbonImmutable $local): bool => $local->dayOfWeekIso === $day);
    }

    public function yearlyOn(int $month, int $day): self
    {
        return $this->on(fn (CarbonImmutable $local): bool => $local->month === $month && $local->day === $day);
    }

    /**
     * Whether the task is due at $local (a time in the company's timezone),
     * before looking at the claim.
     */
    public function isDueAt(CarbonImmutable $local): bool
    {
        return $this->dueTarget($local) !== null;
    }

    /**
     * The scheduled local time the task is due for at $local: today's, or
     * yesterday's while its catch-up window runs past midnight. The day
     * filter is evaluated on that target. Null = not due.
     */
    public function dueTarget(CarbonImmutable $local): ?CarbonImmutable
    {
        foreach ([0, 1] as $daysBack) {
            $target = $local->subDays($daysBack)->setTimeFromTimeString($this->at);

            if ($local->greaterThanOrEqualTo($target)
                && $target->diffInMinutes($local) <= $this->catchUpMinutes
                && ($this->days === null || ($this->days)($target))) {
                return $target;
            }
        }

        return null;
    }

    /**
     * Runs the work and drops its result inside the caller's CompanyContext:
     * a PendingDispatch returned by `fn () => Job::dispatch()` dispatches (and
     * takes its unique lock) when destroyed, which must happen here, not after
     * the context is restored.
     */
    public function perform(Company $company, CarbonImmutable $target): void
    {
        ($this->work)($company, $target);
    }
}
