<?php

namespace App\Http\Resources\Meetings;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MinutesStore;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Props of the meeting pages, shaped like resources/js/features/meetings/types.ts
 * (Person, Meeting, Minutes, ActionItem). Times are ISO-8601 UTC, dates are
 * office dates. Callers eager-load: meeting.participants, meeting.workspace,
 * minutes.actionItems.task.workspace.
 */
final class MeetingPresenter
{
    public function __construct(private readonly MinutesStore $store) {}

    /**
     * @return array<string, mixed>
     */
    public static function person(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'title' => $user->relationLoaded('position') ? ($user->position->name ?? '') : '',
            'division' => $user->relationLoaded('division') ? ($user->division->name ?? '') : '',
            'avatar_url' => $user->getAttribute('avatar_url'),
        ];
    }

    /**
     * @param  iterable<User>  $users
     * @return list<array<string, mixed>>
     */
    public static function people(iterable $users): array
    {
        $result = [];

        foreach ($users as $user) {
            $result[] = self::person($user);
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    public function meeting(Occurrence $occurrence, ?MeetingMinutes $minutes): array
    {
        $meeting = $occurrence->meeting;

        return [
            'id' => $meeting->id,
            'key' => $occurrence->key(),
            'occurrence_date' => $occurrence->date,
            'href' => $occurrence->url(),
            'minutes_href' => $occurrence->url('/notulen'),
            'title' => $meeting->title,
            'description' => $meeting->description,
            'starts_at' => $occurrence->startsAt->toIso8601ZuluString(),
            'ends_at' => $occurrence->endsAt->toIso8601ZuluString(),
            'platform' => $meeting->platform->value,
            'location' => $meeting->location,
            'join_url' => $meeting->join_url,
            'organizer_id' => $meeting->organizer_id,
            'minute_taker_id' => $meeting->minute_taker_id,
            'workspace' => $meeting->workspace !== null
                ? ['id' => $meeting->workspace->id, 'key' => $meeting->workspace->key, 'name' => $meeting->workspace->name]
                : null,
            'participants' => $meeting->participants
                ->sortBy(fn (MeetingParticipant $participant): string => ($participant->user_id === $meeting->organizer_id ? '0' : '1').($participant->email ?? '').$participant->id)
                ->map(fn (MeetingParticipant $participant): array => [
                    'user_id' => $participant->user_id,
                    'email' => $participant->email,
                    'rsvp' => $participant->rsvp->value,
                    'optional' => $participant->optional,
                ])
                ->values()
                ->all(),
            'agenda' => $meeting->agenda,
            'recurrence' => $meeting->recurrence->value,
            'recurrence_until' => $meeting->recurrence_until?->toDateString(),
            'reminders' => $meeting->reminders,
            'leadership' => $meeting->leadership,
            'canceled' => $meeting->isCanceled(),
            'minutes_status' => $minutes?->status->value ?? 'none',
        ];
    }

    /**
     * Minutes of an occurrence; a blank draft (id null) when none were written.
     *
     * @return array<string, mixed>
     */
    public function minutes(Occurrence $occurrence, ?MeetingMinutes $minutes): array
    {
        $content = $minutes?->content() ?? $this->store->blank($occurrence);
        $items = $minutes !== null ? $minutes->actionItems : new Collection;

        return [
            'id' => $minutes?->id,
            'meeting_id' => $occurrence->meeting->id,
            'meeting_key' => $occurrence->key(),
            'href' => $occurrence->url('/notulen'),
            'status' => $minutes?->status->value ?? 'draft',
            'saved_at' => $minutes?->updated_at?->toIso8601ZuluString(),
            'version_count' => $minutes->version ?? 0,
            'finalized_at' => $minutes?->finalized_at?->toIso8601ZuluString(),
            'co_editor_id' => null,
            'attendance' => array_map(fn (array $mark): array => [
                'user_id' => (string) $mark['user_id'],
                'present' => (bool) $mark['present'],
                'reason' => $mark['reason'] ?? null,
            ], $content['attendance']),
            'sections' => $content['sections'],
            'decisions' => $content['decisions'],
            'action_items' => $items->map(fn (MeetingActionItem $item): array => self::actionItem($item))->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function actionItem(MeetingActionItem $item): array
    {
        $task = $item->task_id !== null && $item->relationLoaded('task') ? $item->task : null;

        return [
            'id' => $item->id,
            'text' => $item->text,
            'assignee_id' => $item->assignee_id,
            'due_date' => $item->due_date?->toDateString(),
            'task_key' => $task?->displayKey(),
            'task_url' => $task?->url(),
            'done' => $item->isDone(),
        ];
    }
}
