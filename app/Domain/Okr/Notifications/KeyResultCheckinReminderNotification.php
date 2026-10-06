<?php

namespace App\Domain\Okr\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\KeyResult;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Friday 15.00: the owner has key results without a check-in this week
 * (SendKeyResultCheckinReminders). One notification per owner per week.
 */
final class KeyResultCheckinReminderNotification extends BaseNotification
{
    /**
     * @param  list<string>  $keyResultIds  key results still waiting for a check-in
     */
    public function __construct(
        public readonly User $owner,
        public readonly array $keyResultIds,
    ) {}

    /**
     * Dropped when every key result got its check-in or is gone meanwhile.
     */
    protected function stillVisibleTo(User $notifiable): bool
    {
        return $this->pending()->exists();
    }

    public function type(): NotificationType
    {
        return NotificationType::OkrCheckinReminder;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $pending = $this->pending()->with('objective:id,title')->orderBy('id')->get(['id', 'objective_id', 'title']);
        $count = $pending->count();
        $first = $pending->first();
        $objectives = $pending->pluck('objective_id')->unique();
        $url = $objectives->count() === 1 ? '/okr/'.$objectives->first() : '/okr';

        return new NotificationPayload(
            title: $count === 1 && $first !== null
                ? "Check-in key result \"{$first->title}\""
                : "{$count} key result menunggu check-in minggu ini",
            body: 'Catat nilai terbaru, keyakinan, dan catatan singkat agar progres objective divisi terlihat.',
            url: $url,
            subject: NotificationSubject::fromModel($this->owner, null, 'Check-in OKR'),
            meta: ['open_label' => 'Check-in sekarang', 'context' => 'Jumat 15.00', 'context_tone' => 'warning'],
        );
    }

    /**
     * @return Builder<KeyResult>
     */
    private function pending(): Builder
    {
        return KeyResult::query()->whereIn('id', $this->keyResultIds)->where('owner_id', $this->owner->id);
    }
}
