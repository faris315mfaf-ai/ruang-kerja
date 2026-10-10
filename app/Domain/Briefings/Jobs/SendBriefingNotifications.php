<?php

namespace App\Domain\Briefings\Jobs;

use App\Domain\Briefings\Notifications\BriefingPosted;
use App\Models\Briefing;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification;

/**
 * Notifies every active user of the company — including the recorder — that
 * briefing minutes were saved, in chunks of 200 like company-wide
 * announcements.
 */
final class SendBriefingNotifications implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly string $briefingId) {}

    public function handle(): void
    {
        $briefing = Briefing::query()->with('creator')->find($this->briefingId);

        if ($briefing === null) {
            return;
        }

        User::query()
            ->active()
            ->where('company_id', $briefing->company_id)
            ->chunkById(200, function (Collection $users) use ($briefing): void {
                Notification::send($users, new BriefingPosted($briefing));
            });
    }
}
