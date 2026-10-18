<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Notifications\MeetingInvitedNotification;
use App\Domain\Meetings\Services\MeetingParticipants;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Schedules a meeting (or a series): the organizer joins as a participant who
 * already said yes, the minute taker is invited too, and every other
 * internal participant receives an invitation (in-app + e-mail per their
 * preferences). Conflicts are a warning in the form, never a refusal.
 * External guests (video meetings) are stored with a personal link the
 * organizer copies from the guest list; the app sends no e-mail to guests
 * (docs/sesi/rapat-tamu-eksternal.md).
 *
 * @phpstan-type MeetingInput array{
 *     title: string, description?: string|null, starts_at: CarbonImmutable, ends_at: CarbonImmutable,
 *     platform: MeetingPlatform, location?: string|null, join_url?: string|null,
 *     minute_taker_id?: string|null, workspace_id?: string|null, agenda: list<string>,
 *     recurrence: Recurrence, recurrence_until?: string|null, reminders: list<int>, leadership?: bool, auto_minutes?: bool,
 *     participant_ids: list<string>, guest_emails?: list<string>, guest_names?: array<string, string|null>
 * }
 */
final class ScheduleMeeting
{
    public function __construct(private readonly MeetingParticipants $participants) {}

    /**
     * @param  MeetingInput  $input
     */
    public function handle(User $organizer, array $input): Meeting
    {
        $invited = [];

        $meeting = DB::transaction(function () use ($organizer, $input, &$invited): Meeting {
            $meeting = Meeting::query()->create([
                'company_id' => $organizer->company_id,
                'organizer_id' => $organizer->id,
                ...self::attributes($input),
            ]);

            $this->participants->add($meeting, [$organizer->id], Rsvp::Yes);
            $invited = $this->participants->add($meeting, [
                ...$input['participant_ids'],
                ...($meeting->minute_taker_id !== null ? [$meeting->minute_taker_id] : []),
            ]);
            $this->participants->addGuests($meeting, $input['guest_emails'] ?? [], $input['guest_names'] ?? []);

            return $meeting;
        });

        foreach ($invited as $user) {
            $user->notify(new MeetingInvitedNotification($meeting, $organizer));
        }

        return $meeting;
    }

    /**
     * Column values shared with UpdateMeeting.
     *
     * @param  MeetingInput  $input
     * @return array<string, mixed>
     */
    public static function attributes(array $input): array
    {
        $platform = $input['platform'];
        $recurrence = $input['recurrence'];

        return [
            'title' => trim($input['title']),
            'description' => isset($input['description']) && trim($input['description']) !== '' ? trim($input['description']) : null,
            'starts_at' => $input['starts_at']->utc(),
            'ends_at' => $input['ends_at']->utc(),
            'platform' => $platform,
            'location' => $platform->isOnline() ? null : (trim((string) ($input['location'] ?? '')) ?: null),
            // The built-in video room needs no pasted link.
            'join_url' => $platform->isOnline() && $platform !== MeetingPlatform::Video ? (trim((string) ($input['join_url'] ?? '')) ?: null) : null,
            'minute_taker_id' => $input['minute_taker_id'] ?? null,
            'workspace_id' => $input['workspace_id'] ?? null,
            'agenda' => array_values(array_filter(array_map(trim(...), $input['agenda']), fn (string $item): bool => $item !== '')),
            'recurrence' => $recurrence,
            'recurrence_until' => $recurrence === Recurrence::None ? null : ($input['recurrence_until'] ?? null),
            'reminders' => array_values(array_unique($input['reminders'])),
            'leadership' => (bool) ($input['leadership'] ?? false),
            // "Notulen otomatis" exists only for the built-in video room.
            'auto_minutes' => $platform === MeetingPlatform::Video && (bool) ($input['auto_minutes'] ?? false),
        ];
    }
}
