<?php

namespace App\Domain\Meetings\Queries;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * /rapat: the viewer's meetings (organizer, minute taker, invited) in the
 * office week of `$day` — Monday to Sunday, recurring series expanded —
 * plus their open follow-ups across all minutes they can see and the drafts
 * waiting for them as minute taker.
 */
final class AgendaQuery
{
    public function __construct(private readonly MeetingFeed $feed) {}

    /**
     * @return array{week_start: string, meetings: list<array<string, mixed>>, follow_ups: list<array<string, mixed>>, people: list<array<string, mixed>>}
     */
    public function forUser(User $viewer, ?CarbonImmutable $day = null): array
    {
        $timezone = CurrentCompany::timezone();
        $day = ($day ?? CarbonImmutable::now())->setTimezone($timezone);
        $from = $day->startOfWeek(CarbonImmutable::MONDAY)->startOfDay();
        $to = $from->addWeek();

        $occurrences = $this->feed->occurrences(
            Meeting::query()->involving($viewer)->active(),
            $from->utc(),
            $to->utc(),
        );
        $minutes = $this->feed->minutesFor($occurrences);
        $followUps = $this->followUps($viewer);

        return [
            'week_start' => $from->toDateString(),
            'meetings' => $this->feed->present($occurrences, $minutes),
            'follow_ups' => $followUps,
            'people' => $this->feed->people($occurrences, $minutes, [$viewer->id]),
        ];
    }

    /**
     * Open follow-ups assigned to the viewer (not done, no task yet — tasks
     * show up in Tugas saya), most urgent first.
     *
     * @return list<array<string, mixed>>
     */
    private function followUps(User $viewer): array
    {
        return array_values(MeetingActionItem::query()
            ->where('assignee_id', $viewer->id)
            ->whereNull('done_at')
            ->whereNull('task_id')
            ->whereHas('minutes.meeting', fn (Builder $meeting) => $meeting->visibleTo($viewer)->whereNull('canceled_at'))
            ->with('minutes.meeting:id,title,recurrence,starts_at,ends_at')
            ->orderByRaw('due_date asc nulls last')
            ->orderBy('id')
            ->limit(20)
            ->get()
            ->map(function (MeetingActionItem $item): array {
                $minutes = $item->minutes;
                $meeting = $minutes->meeting;
                $occurrence = new Occurrence($meeting, $minutes->occurrence_date->toDateString(), $meeting->starts_at, $meeting->ends_at);

                return [
                    ...MeetingPresenter::actionItem($item),
                    'meeting_id' => $meeting->id,
                    'meeting_title' => $meeting->title,
                    'minutes_href' => $occurrence->url('/notulen'),
                ];
            })
            ->all());
    }
}
