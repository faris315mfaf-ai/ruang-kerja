<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Notifications\MeetingCalledNotification;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Services\MeetingCalls;
use App\Domain\Meetings\Services\MeetingParticipants;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Validation\ValidationException;

/**
 * "Panggil" in the Kehadiran panel (MeetingPolicy::callParticipant:
 * organizer or minute taker): an invited employee who is not in the video
 * room gets the in-app notification "Rapat sudah dimulai — Gabung" (toast +
 * Inbox; e-mail per their `meeting` preference) linking to the pre-join
 * screen. Only while the room is open, once per minute per called person
 * (ThrottleRequestsException → 429 with retry_after), audited as
 * `meeting.video_participant_called`, broadcast as `participant.called`.
 */
final class CallMeetingParticipant
{
    public function __construct(
        private readonly MeetingParticipants $participants,
        private readonly VideoAttendance $attendance,
        private readonly VideoRooms $rooms,
        private readonly MeetingCalls $calls,
        private readonly RoomEvents $events,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Occurrence $occurrence, User $actor, User $target, ?CarbonImmutable $now = null): CarbonImmutable
    {
        $now ??= CarbonImmutable::now();
        $meeting = $occurrence->meeting;

        if ($target->id === $actor->id) {
            throw ValidationException::withMessages(['user' => 'Anda tidak bisa memanggil diri sendiri.']);
        }

        $invited = array_column($this->participants->invited($meeting), 'user_id');

        if (! in_array($target->id, $invited, true) || $target->company_id !== $meeting->company_id || ! $target->isActive()) {
            throw ValidationException::withMessages(['user' => 'Orang ini tidak diundang ke rapat ini.']);
        }

        if ($this->rooms->windowState($occurrence, $now) !== 'open') {
            throw ValidationException::withMessages(['user' => 'Ruang rapat sedang tidak dibuka.']);
        }

        foreach ($this->attendance->roster($occurrence, $now)['attendance'] as $person) {
            if ($person['user_id'] === $target->id && $person['in_room']) {
                throw ValidationException::withMessages(['user' => "{$target->name} sudah ada di ruang rapat."]);
            }
        }

        $wait = $this->calls->claim($occurrence, $target->id);

        if ($wait !== null) {
            throw new ThrottleRequestsException("{$target->name} baru saja dipanggil. Coba lagi dalam {$wait} detik.", null, ['Retry-After' => (string) $wait]);
        }

        $target->notify(new MeetingCalledNotification($meeting, $occurrence->date, $actor));
        $this->calls->remember($occurrence, $target->id, $now);

        $this->audit->log('meeting.video_participant_called', $meeting, null, [
            'occurrence_date' => $occurrence->date,
            'user_id' => $target->id,
        ], $actor);

        $this->events->participantCalled($occurrence, $target->id, $actor->id, $now);

        return $now;
    }
}
