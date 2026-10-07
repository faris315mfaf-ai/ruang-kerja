<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Jobs\DisconnectUninvited;
use App\Domain\Meetings\Notifications\MeetingInvitedNotification;
use App\Domain\Meetings\Services\MeetingParticipants;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Organizer edits a meeting. Participants are synced (new ones invited,
 * removed ones dropped). When the time changes, everyone else's RSVP goes
 * back to "Belum menjawab" and they are told the schedule changed.
 *
 * @phpstan-import-type MeetingInput from ScheduleMeeting
 */
final class UpdateMeeting
{
    public function __construct(
        private readonly MeetingParticipants $participants,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  MeetingInput  $input
     */
    public function handle(Meeting $meeting, User $actor, array $input): Meeting
    {
        $added = [];
        $moved = false;
        $before = self::involvedIds($meeting);

        DB::transaction(function () use ($meeting, $actor, $input, &$added, &$moved): void {
            $attributes = ScheduleMeeting::attributes($input);
            $moved = ! $meeting->starts_at->equalTo($attributes['starts_at'])
                || ! $meeting->ends_at->equalTo($attributes['ends_at'])
                || $meeting->recurrence !== $attributes['recurrence'];

            $autoBefore = $meeting->auto_minutes;
            $meeting->fill($attributes)->save();

            // Same audit row as PUT …/notulen-otomatis/pengaturan (SetAutoMinutes).
            if ($autoBefore !== $meeting->auto_minutes) {
                $this->audit->log('meeting.auto_minutes_changed', $meeting, ['auto_minutes' => $autoBefore], ['auto_minutes' => $meeting->auto_minutes], $actor);
            }

            $added = $this->participants->sync($meeting, [
                ...$input['participant_ids'],
                ...($meeting->minute_taker_id !== null ? [$meeting->minute_taker_id] : []),
            ], $input['guest_emails'] ?? []);

            if ($moved) {
                MeetingParticipant::query()
                    ->where('meeting_id', $meeting->id)
                    ->whereNotNull('user_id')
                    ->where('user_id', '!=', $meeting->organizer_id)
                    ->update(['rsvp' => Rsvp::Pending->value, 'responded_at' => null]);
            }
        });

        $meeting->load('participants.user');

        // Taken off the invitation: out of the video rooms and the collaborative minutes (audit B-07).
        $uninvited = array_values(array_diff($before, self::involvedIds($meeting)));

        if ($uninvited !== []) {
            DisconnectUninvited::dispatch($meeting->id, $uninvited);
        }

        $addedIds = array_map(fn (User $user): string => $user->id, $added);

        foreach ($added as $user) {
            $user->notify(new MeetingInvitedNotification($meeting, $actor));
        }

        if ($moved) {
            foreach ($meeting->participants as $participant) {
                $user = $participant->user;

                if ($user !== null && $user->id !== $actor->id && ! in_array($user->id, $addedIds, true) && $user->isActive()) {
                    $user->notify(new MeetingInvitedNotification($meeting, $actor, MeetingInvitedNotification::CHANGED));
                }
            }
        }

        return $meeting;
    }

    /**
     * Employees involved in the meeting: organizer, minute taker, internal participants.
     *
     * @return list<string>
     */
    private static function involvedIds(Meeting $meeting): array
    {
        $ids = MeetingParticipant::query()->where('meeting_id', $meeting->id)->whereNotNull('user_id')->pluck('user_id')->all();

        return array_values(array_unique(array_filter(
            [$meeting->organizer_id, $meeting->minute_taker_id, ...array_map(strval(...), $ids)],
            fn (?string $id): bool => $id !== null && $id !== '',
        )));
    }
}
