<?php

namespace App\Domain\Meetings\Notifications;

use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Domain\Tenancy\Support\OfficeTimezone;
use App\Models\Meeting;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;

/**
 * Shared parts of the meeting notifications: subject = the meeting, link =
 * /rapat/{id} (with ?tanggal= for one occurrence of a series). Dropped when
 * the meeting was deleted or canceled, or the recipient can no longer see it.
 */
abstract class MeetingNotification extends BaseNotification
{
    public function __construct(
        public readonly Meeting $meeting,
        public readonly ?string $date = null,
    ) {}

    protected function stillVisibleTo(User $notifiable): bool
    {
        $meeting = Meeting::query()->find($this->meeting->id);

        return $meeting !== null
            && ! $meeting->isCanceled()
            && app(MeetingPolicy::class)->canView($notifiable, $meeting);
    }

    protected function subject(): NotificationSubject
    {
        return NotificationSubject::fromModel($this->meeting, null, $this->meeting->title);
    }

    protected function url(string $suffix = ''): string
    {
        $path = '/rapat/'.$this->meeting->id.$suffix;

        return $this->meeting->isRecurring() && $this->date !== null ? $path.'?tanggal='.$this->date : $path;
    }

    /** "Sen, 5 Okt 2026 · 10.30–11.30 WIB" (zone of the company: WIB/WITA/WIT). */
    protected function when(): string
    {
        $occurrences = app(MeetingOccurrences::class);
        $occurrence = $this->date !== null ? $occurrences->at($this->meeting, $this->date) : null;
        $occurrence ??= $occurrences->resolve($this->meeting, null);
        $timezone = CurrentCompany::timezone();
        $start = $occurrence->startsAt->setTimezone($timezone);
        $end = $occurrence->endsAt->setTimezone($timezone);

        return IndonesianDate::short($start).' · '.$start->format('H.i').'–'.$end->format('H.i').' '.OfficeTimezone::label($timezone);
    }

    protected function place(): string
    {
        $location = $this->meeting->location;

        return $this->meeting->platform->label().($location !== null && $location !== '' ? ' · '.$location : '');
    }

    protected static function officeNow(): CarbonImmutable
    {
        return CarbonImmutable::now()->setTimezone(CurrentCompany::timezone());
    }

    /**
     * Drops null values (the Inbox only understands scalar meta values).
     *
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    protected static function meta(array $meta): array
    {
        return array_filter($meta, fn (mixed $value): bool => $value !== null);
    }
}
