<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Notifications\MeetingInvitedNotification;
use App\Domain\Meetings\Services\MeetingParticipants;
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
    public function __construct(private readonly MeetingParticipants $participants) {}

    /**
     * @param  MeetingInput  $input
     */
    public function handle(Meeting $meeting, User $actor, array $input): Meeting
    {
        $added = [];
        $moved = false;

        DB::transaction(function () use ($meeting, $input, &$added, &$moved): void {
            $attributes = ScheduleMeeting::attributes($input);
            $moved = ! $meeting->starts_at->equalTo($attributes['starts_at'])
                || ! $meeting->ends_at->equalTo($attributes['ends_at'])
                || $meeting->recurrence !== $attributes['recurrence'];

            $meeting->fill($attributes)->save();

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
}
