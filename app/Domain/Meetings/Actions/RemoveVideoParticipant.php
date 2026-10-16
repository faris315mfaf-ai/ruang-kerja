<?php

namespace App\Domain\Meetings\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\LobbyStatus;
use App\Domain\Meetings\Guests\Actions\IssueGuestVideoToken;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\MinutesCollab;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\MeetingParticipant;
use App\Models\MeetingVideoRemoval;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Organizer removes someone from the video room (MeetingPolicy::moderateVideo),
 * audited as `meeting.video_participant_removed`. An employee removed this
 * way is kept out of that occurrence's room (meeting_video_removals:
 * joinVideo refuses a new token, audit R-04) until the organizer re-admits
 * them (ReadmitVideoParticipant); in the collaborative minutes they only
 * read meanwhile (editors reconnect). The block is stored before LiveKit is
 * called, so a failing Room Service call (RuntimeException) still keeps
 * them from rejoining.
 *
 * An external guest (identity `guest:{participant id}`) is excluded the same
 * way: the waiting-room status becomes `removed` for that occurrence, so no
 * new token is issued until someone admits them again ("Izinkan masuk");
 * audited as `meeting.guest_kicked`.
 */
final class RemoveVideoParticipant
{
    public function __construct(
        private readonly VideoRooms $rooms,
        private readonly LiveKitRoomService $service,
        private readonly AuditLogger $audit,
        private readonly MinutesStore $store,
        private readonly MinutesCollab $collab,
    ) {}

    public function handle(User $actor, Occurrence $occurrence, string $identity): void
    {
        if ($identity === $actor->id) {
            throw new InvalidArgumentException('Use the leave button to leave the room yourself.');
        }

        $guestId = IssueGuestVideoToken::participantId($identity);

        if ($guestId !== null) {
            $this->removeGuest($actor, $occurrence, $guestId, $identity);

            return;
        }

        $userId = User::query()->whereKey($identity)->where('company_id', $occurrence->meeting->company_id)->value('id');

        if (is_string($userId)) {
            MeetingVideoRemoval::query()->updateOrCreate(
                ['meeting_id' => $occurrence->meeting->id, 'occurrence_date' => $occurrence->date, 'user_id' => $userId],
                ['removed_by' => $actor->id],
            );
        }

        $this->audit->log('meeting.video_participant_removed', $occurrence->meeting, null, [
            'occurrence_date' => $occurrence->date,
            'identity' => $identity,
        ], $actor);

        // Collaborative minutes: editors reconnect with fresh tokens, read-only for
        // the removed person (MinutesCollab::canEdit, audit rapat 2026-10 B-02).
        $minutes = $this->store->find($occurrence);

        if ($minutes !== null) {
            $this->collab->reconnect($minutes);
        }

        $this->service->removeParticipant($this->rooms->roomName($occurrence), $identity);
    }

    private function removeGuest(User $actor, Occurrence $occurrence, string $guestId, string $identity): void
    {
        $guest = MeetingParticipant::query()
            ->whereKey($guestId)
            ->where('meeting_id', $occurrence->meeting->id)
            ->whereNull('user_id')
            ->first();

        if ($guest === null) {
            throw new InvalidArgumentException('Unknown guest.');
        }

        DB::transaction(function () use ($actor, $occurrence, $guest): void {
            /** @var MeetingParticipant $row */
            $row = MeetingParticipant::query()->whereKey($guest->id)->lockForUpdate()->firstOrFail();

            // Only the occurrence the guest was admitted to is closed to them.
            if ($row->lobby_occurrence_date?->toDateString() === $occurrence->date) {
                $row->forceFill([
                    'lobby_status' => LobbyStatus::Removed,
                    'removed_at' => CarbonImmutable::now(),
                    'removed_by' => $actor->id,
                    'joined_at' => null,
                ])->save();
            }

            $this->audit->log('meeting.guest_kicked', $occurrence->meeting, null, [
                'occurrence_date' => $occurrence->date,
                'participant_id' => $row->id,
                'guest_name' => $row->guest_name,
            ], $actor);
        });

        $this->service->removeParticipant($this->rooms->roomName($occurrence), $identity);
    }
}
