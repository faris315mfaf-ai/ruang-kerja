<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Domain\Notifications\Jobs\SendDailyDigest;
use App\Domain\Notifications\Services\NotificationPreferenceResolver;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\NotificationSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/**
 * Runs every 5 minutes (routes/console.php). For each user whose digest time
 * (office timezone) has passed today — within notifications.digest.catch_up_minutes
 * — and who has not had today's run yet, claims the day and queues
 * SendDailyDigest. Idempotent: the day is claimed with a conditional UPDATE
 * (`digest_last_run_on` < today), so overlapping runs (or several servers)
 * queue one digest per user and day.
 */
final class DispatchDueDailyDigests
{
    public function __construct(
        private readonly WorkdayCalendar $calendar,
        private readonly NotificationPreferenceResolver $preferences,
    ) {}

    /**
     * @return int number of digests queued
     */
    public function handle(CarbonImmutable $now): int
    {
        $local = $now->setTimezone(CurrentCompany::timezone());

        // Off for every company (weekend, shared holiday): nothing to do.
        if (! $this->calendar->isWorkday($local->startOfDay())) {
            return 0;
        }

        $today = $local->toDateString();
        $catchUp = config()->integer('notifications.digest.catch_up_minutes', 60);
        $queued = 0;
        /** @var array<string, bool> $workdays holidays are per company (C5) */
        $workdays = [];

        User::query()->active()->orderBy('id')->chunkById(200, function (Collection $users) use ($local, $today, $catchUp, &$queued, &$workdays): void {
            // Preloaded per chunk: no per-user settings or preference queries.
            $settings = NotificationSetting::query()->whereIn('user_id', $users->modelKeys())->get()->keyBy('user_id');
            $wantsDigest = $this->preferences->enabledFor(array_values($users->modelKeys()), NotificationEvent::DailyDigest, NotificationChannel::Email);

            /** @var User $user */
            foreach ($users as $user) {
                if (! ($workdays[$user->company_id] ??= $this->calendar->isWorkday($local->startOfDay(), $user->company_id))) {
                    continue;
                }

                $setting = $settings->get($user->id) ?? NotificationSetting::defaultsFor($user);

                if ($setting->digest_last_run_on?->toDateString() === $today) {
                    continue;
                }

                $scheduled = $local->setTimeFromTimeString($setting->digest_time);

                if ($local->lessThan($scheduled) || $scheduled->diffInMinutes($local) > $catchUp) {
                    continue;
                }

                if (! ($wantsDigest[$user->id] ?? false)) {
                    continue;
                }

                if (! $this->claimDay($setting, $today)) {
                    continue;
                }

                SendDailyDigest::dispatch($user, $today);
                $queued++;
            }
        });

        return $queued;
    }

    /**
     * Atomically records today's run; false when another run already did.
     */
    private function claimDay(NotificationSetting $setting, string $today): bool
    {
        if (! $setting->exists) {
            // Defaults row for people who never opened the settings (concurrent-safe).
            NotificationSetting::query()->insertOrIgnore([
                ...$setting->getAttributes(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return NotificationSetting::query()
            ->whereKey($setting->user_id)
            ->where(fn ($query) => $query->whereNull('digest_last_run_on')->orWhere('digest_last_run_on', '<', $today))
            ->update(['digest_last_run_on' => $today, 'updated_at' => now()]) === 1;
    }
}
