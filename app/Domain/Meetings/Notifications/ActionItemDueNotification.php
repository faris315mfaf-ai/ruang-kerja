<?php

namespace App\Domain\Meetings\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Models\MeetingActionItem;
use App\Models\User;
use App\Policies\MeetingPolicy;

/**
 * Follow-up reminder to its assignee ("Perlu tindakan" until it is ticked off
 * or becomes a task): `soon` = due tomorrow, `overdue` = past due
 * (SendActionItemReminders, daily), `reminder` = "Ingatkan PIC" from the
 * minutes (RemindActionItemOwners).
 */
final class ActionItemDueNotification extends BaseNotification
{
    public function __construct(
        public readonly MeetingActionItem $item,
        public readonly string $kind,
        public readonly ?User $actor = null,
    ) {}

    public function type(): NotificationType
    {
        return NotificationType::ActionItemDue;
    }

    protected function stillVisibleTo(User $notifiable): bool
    {
        $item = MeetingActionItem::query()->with('minutes.meeting')->find($this->item->id);
        $meeting = $item?->minutes->meeting;

        return $item !== null && $meeting !== null && $item->done_at === null && $item->task_id === null
            && app(MeetingPolicy::class)->canView($notifiable, $meeting);
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $this->item->loadMissing('minutes.meeting');
        $minutes = $this->item->minutes;
        $meeting = $minutes->meeting;
        $due = $this->item->due_date;

        $title = match ($this->kind) {
            'soon' => 'Tindak lanjut rapat jatuh tempo besok',
            'overdue' => 'Tindak lanjut rapat terlambat',
            default => ($this->actor !== null ? $this->actor->name.' mengingatkan' : 'Pengingat').' tindak lanjut rapat',
        };

        $url = '/rapat/'.$meeting->id.'/notulen'.($meeting->isRecurring() ? '?tanggal='.$minutes->occurrence_date->toDateString() : '');

        return new NotificationPayload(
            title: $title,
            body: $this->item->text,
            url: $url,
            subject: NotificationSubject::fromModel($this->item, null, $this->item->text),
            meta: array_filter([
                'open_label' => 'Buka notulen',
                'context' => $meeting->title.($due !== null ? ' · tenggat '.IndonesianDate::short($due) : ''),
                'context_tone' => $this->kind === 'overdue' ? 'danger' : 'warning',
            ]),
        );
    }
}
