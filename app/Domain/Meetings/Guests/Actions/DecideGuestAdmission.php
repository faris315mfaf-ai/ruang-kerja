<?php

namespace App\Domain\Meetings\Guests\Actions;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\LobbyStatus;
use App\Domain\Meetings\Guests\GuestAccessException;
use App\Domain\Meetings\Guests\Services\GuestAccess;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * "Izinkan masuk" / "Tolak" a guest in the waiting room (MeetingPolicy::
 * manageLobby: organizer, minute taker, internal participants). The decision
 * concerns the occurrence the guest asked for (`lobby_occurrence_date`), which
 * must still be inside its join window.
 *
 * - admit: from waiting, and from denied / removed ("Izinkan masuk lagi" lifts
 *   the exclusion). A guest who never asked cannot be pre-admitted.
 * - deny: only from waiting (a guest already inside is removed with
 *   RemoveVideoParticipant instead).
 *
 * Audit `meeting.guest_admitted` / `meeting.guest_denied` (no token).
 */
final class DecideGuestAdmission
{
    public function __construct(
        private readonly GuestAccess $access,
        private readonly AuditLogger $audit,
        private readonly RoomEvents $events,
    ) {}

    /**
     * @throws GuestAccessException
     */
    public function handle(User $actor, Meeting $meeting, MeetingParticipant $guest, bool $admit, ?CarbonImmutable $now = null): MeetingParticipant
    {
        $now ??= CarbonImmutable::now();
        /** @var Occurrence|null $occurrence */
        $occurrence = null;

        DB::transaction(function () use ($actor, $meeting, $guest, $admit, $now, &$occurrence): void {
            /** @var MeetingParticipant $row */
            $row = MeetingParticipant::query()->whereKey($guest->id)->where('meeting_id', $meeting->id)->lockForUpdate()->firstOrFail();
            $row->setRelation('meeting', $meeting);
            $state = $this->access->inspect($row, $now);

            if ($state->status === 'closed') {
                throw GuestAccessException::closed();
            }

            if ($state->status === 'expired') {
                throw GuestAccessException::expired();
            }

            $current = LobbyStatus::from($state->status);

            // Two people pressed the same button: the second one changes nothing.
            if (($admit && $current === LobbyStatus::Admitted) || (! $admit && $current === LobbyStatus::Denied)) {
                return;
            }

            $allowed = $admit
                ? in_array($current, [LobbyStatus::Waiting, LobbyStatus::Denied, LobbyStatus::Removed], true)
                : $current === LobbyStatus::Waiting;

            if (! $allowed) {
                throw new GuestAccessException(
                    $current === LobbyStatus::None ? 'belum_meminta' : 'status_berubah',
                    $current === LobbyStatus::None ? 'Tamu ini belum meminta masuk.' : 'Status tamu sudah berubah. Muat ulang daftar.',
                    409,
                );
            }

            $occurrence = $state->occurrence;
            $date = $occurrence?->date;

            $row->forceFill($admit ? [
                'lobby_status' => LobbyStatus::Admitted,
                'admitted_at' => $now,
                'admitted_by' => $actor->id,
                'denied_at' => null,
                'denied_by' => null,
                'removed_at' => null,
                'removed_by' => null,
                'joined_at' => null,
            ] : [
                'lobby_status' => LobbyStatus::Denied,
                'denied_at' => $now,
                'denied_by' => $actor->id,
            ])->save();

            $this->audit->log($admit ? 'meeting.guest_admitted' : 'meeting.guest_denied', $meeting, null, [
                'participant_id' => $row->id,
                'occurrence_date' => $date,
                'guest_name' => $row->guest_name,
                'was' => $current->value,
            ], $actor);
        });

        $fresh = MeetingParticipant::query()->findOrFail($guest->id);

        if ($occurrence !== null) {
            $this->events->lobbyUpdated($occurrence, MeetingParticipant::query()
                ->where('meeting_id', $meeting->id)
                ->where('lobby_status', LobbyStatus::Waiting->value)
                ->whereDate('lobby_occurrence_date', $occurrence->date)
                ->count());
        }

        return $fresh;
    }
}
