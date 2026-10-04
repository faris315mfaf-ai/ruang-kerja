<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Domain\Notifications\Jobs\SendDailyDigest;
use App\Domain\Notifications\Services\NotificationPreferenceResolver;
use App\Models\NotificationSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/**
 * Runs every 5 minutes (routes/console.php). For each user whose digest time
 * (office timezone) has passed today — within notifications.digest.catch_up_minutes
 * — and who has not had today's run yet, records the run and queues
 * SendDailyDigest. Idempotent: running again the same day does nothing.
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
        $local = $now->setTimezone((string) config('app.office_timezone'));

        if (! $this->calendar->isWorkday($local->startOfDay())) {
            return 0;
        }

        $today = $local->toDateString();
        $catchUp = config()->integer('notifications.digest.catch_up_minutes', 60);
        $queued = 0;

        User::query()->active()->orderBy('id')->chunkById(200, function (Collection $users) use ($local, $today, $catchUp, &$queued): void {
            $settings = NotificationSetting::query()->whereIn('user_id', $users->modelKeys())->get()->keyBy('user_id');

            /** @var User $user */
            foreach ($users as $user) {
                $setting = $settings->get($user->id) ?? NotificationSetting::for($user);

                if ($setting->digest_last_run_on?->toDateString() === $today) {
                    continue;
                }

                $scheduled = $local->setTimeFromTimeString($setting->digest_time);

                if ($local->lessThan($scheduled) || $scheduled->diffInMinutes($local) > $catchUp) {
                    continue;
                }

                if (! $this->preferences->isEnabled($user, NotificationEvent::DailyDigest, NotificationChannel::Email)) {
                    continue;
                }

                $setting->digest_last_run_on = $local->startOfDay();
                $setting->save();

                SendDailyDigest::dispatch($user, $today);
                $queued++;
            }
        });

        return $queued;
    }
}
