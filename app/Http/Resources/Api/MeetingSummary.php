<?php

namespace App\Http\Resources\Api;

use App\Domain\Meetings\Data\Occurrence;
use App\Models\MeetingMinutes;
use App\Models\MeetingParticipant;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Illuminate\Support\Collection;

/**
 * Compact meeting occurrence for the mobile app (API v1): the agenda row
 * (GET /rapat) and the detail (GET /rapat/{meeting}) reuse the web loaders
 * (MeetingFeed, MeetingOccurrences, MinutesStore) and this presenter shapes
 * them for the phone — times are ISO-8601 UTC instants the app renders in
 * WIB, dates are office dates, exactly like the web Meeting type. Callers
 * eager-load `participants` and `workspace` (MeetingFeed does).
 */
final class MeetingSummary
{
    /**
     * One agenda row of GET /rapat.
     *
     * @param  array<string, string>  $names  user id => display name (organizers, minute takers)
     * @return array<string, mixed>
     */
    public static function agenda(Occurrence $occurrence, ?MeetingMinutes $minutes, User $viewer, MeetingPolicy $policy, array $names, string $today): array
    {
        $meeting = $occurrence->meeting;

        return [
            'id' => $meeting->id,
            'key' => $occurrence->key(),
            'occurrence_date' => $occurrence->date,
            'title' => $meeting->title,
            'starts_at' => $occurrence->startsAt->toIso8601ZuluString(),
            'ends_at' => $occurrence->endsAt->toIso8601ZuluString(),
            'platform' => $meeting->platform->value,
            'platform_label' => $meeting->platform->label(),
            'location' => $meeting->location,
            'join_url' => $meeting->join_url,
            'organizer' => ['id' => $meeting->organizer_id, 'name' => $names[$meeting->organizer_id] ?? null],
            'workspace' => $meeting->workspace !== null
                ? ['id' => $meeting->workspace->id, 'key' => $meeting->workspace->key, 'name' => $meeting->workspace->name]
                : null,
            'peserta_count' => $meeting->participants->count(),
            'rsvp_saya' => $meeting->participantFor($viewer)?->rsvp->value,
            'terjadi_hari_ini' => $occurrence->date === $today,
            'dapat_diedit' => $policy->update($viewer, $meeting)->allowed(),
            'recurrence' => $meeting->recurrence->value,
            'recurrence_until' => $meeting->recurrence_until?->toDateString(),
            'canceled' => $meeting->isCanceled(),
            'minutes_status' => $minutes?->status->value ?? 'none',
        ];
    }

    /**
     * The agenda row plus the full detail fields (GET /rapat/{meeting}).
     *
     * @param  array<string, string>  $names  user id => display name (participants, organizer, minute taker)
     * @return array<string, mixed>
     */
    public static function detail(Occurrence $occurrence, ?MeetingMinutes $minutes, User $viewer, MeetingPolicy $policy, array $names, string $today): array
    {
        $meeting = $occurrence->meeting;

        return [
            ...self::agenda($occurrence, $minutes, $viewer, $policy, $names, $today),
            'description' => $meeting->description,
            'agenda_items' => $meeting->agenda,
            'reminders' => $meeting->reminders,
            'minute_taker' => $meeting->minute_taker_id !== null
                ? ['id' => $meeting->minute_taker_id, 'name' => $names[$meeting->minute_taker_id] ?? null]
                : null,
            'leadership' => $meeting->leadership,
            'auto_minutes' => $meeting->auto_minutes,
            'participants' => $meeting->participants
                ->sortBy(fn (MeetingParticipant $participant): string => ($participant->user_id === $meeting->organizer_id ? '0' : '1').($participant->email ?? '').$participant->id)
                ->map(fn (MeetingParticipant $participant): array => [
                    'user_id' => $participant->user_id,
                    'email' => $participant->email,
                    'nama' => $participant->user_id !== null ? ($names[$participant->user_id] ?? null) : null,
                    'rsvp' => $participant->rsvp->value,
                    'optional' => $participant->optional,
                ])
                ->values()
                ->all(),
            // Minutes teaser: full minutes live at GET /rapat/{meeting}/notulen.
            'notulen' => [
                'status' => $minutes?->status->value ?? 'none',
                'ada_isi' => self::hasContent($minutes),
            ],
        ];
    }

    /**
     * Whether anything was written (any section body or a decision) — the
     * detail teaser; a blank draft answers false like the web editor.
     */
    public static function hasContent(?MeetingMinutes $minutes): bool
    {
        if ($minutes === null) {
            return false;
        }

        return collect($minutes->sections)->contains(fn (array $section): bool => trim((string) $section['body']) !== '')
            || $minutes->decisions !== [];
    }

    /**
     * Display names of the given users in one query (agenda organizers,
     * detail participants) — no N+1.
     *
     * @param  iterable<null|string|int>  $ids
     * @return array<string, string>
     */
    public static function names(iterable $ids): array
    {
        $valid = [];

        foreach ($ids as $id) {
            if (is_string($id) && $id !== '') {
                $valid[] = $id;
            }
        }

        $valid = array_values(array_unique($valid));

        if ($valid === []) {
            return [];
        }

        $map = [];

        foreach (User::query()->whereIn('id', $valid)->pluck('name', 'id') as $id => $name) {
            $map[(string) $id] = (string) $name;
        }

        return $map;
    }

    /**
     * Organizer + minute taker ids of the occurrences (the agenda rows).
     *
     * @param  Collection<int, Occurrence>  $occurrences
     * @return array<string, string>
     */
    public static function namesFor(Collection $occurrences): array
    {
        $ids = [];

        foreach ($occurrences as $occurrence) {
            $ids[] = $occurrence->meeting->organizer_id;
            $ids[] = $occurrence->meeting->minute_taker_id;
        }

        return self::names($ids);
    }
}
