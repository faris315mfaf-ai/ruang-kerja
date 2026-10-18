<?php

namespace App\Domain\Notifications\Jobs;

use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Notifications\Digest\DailyDigestMail;
use App\Domain\Notifications\Digest\DigestBuilder;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Domain\Notifications\Services\NotificationPreferenceResolver;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\NotificationSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

/**
 * Builds and emails one user's digest. Empty digests are skipped.
 */
final class SendDailyDigest implements ShouldQueue
{
    use CompanyAware;
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /**
     * @var list<int>
     */
    public array $backoff = [60, 300];

    public function __construct(
        public readonly User $user,
        public readonly string $date,
    ) {}

    public function handle(DigestBuilder $builder, NotificationPreferenceResolver $preferences, UserAvailability $availability): void
    {
        if (! $preferences->isEnabled($this->user, NotificationEvent::DailyDigest, NotificationChannel::Email)) {
            return;
        }

        $setting = NotificationSetting::for($this->user);

        if ($setting->pause_while_on_leave && $availability->isOnLeave($this->user, CarbonImmutable::now())) {
            return;
        }

        $date = CarbonImmutable::parse($this->date, (string) config('app.office_timezone'))->startOfDay();
        $digest = $builder->build($this->user, $date);

        if ($digest->isEmpty()) {
            return;
        }

        Mail::to($this->user)->send(new DailyDigestMail($digest, $setting->digestTimeShort()));
    }
}
