<?php

namespace App\Domain\Meetings\Guests\Actions;

use App\Domain\Meetings\Enums\LobbyStatus;
use App\Domain\Meetings\Guests\GuestAccessException;
use App\Domain\Meetings\Guests\GuestNames;
use App\Domain\Meetings\Guests\GuestState;
use App\Domain\Meetings\Guests\Services\GuestAccess;
use App\Domain\Meetings\Services\RoomEvents;
use App\Domain\Meetings\Services\VideoRooms;
use App\Models\MeetingParticipant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * "Minta masuk": the guest typed a name and joins the waiting room of the
 * current occurrence (POST /api/tamu/{token}/minta-masuk). Only inside the
 * join window. Idempotent while waiting (the name may be corrected); a guest
 * who was denied or removed stays so until the organizer admits them again —
 * asking again does not reopen the question.
 */
final class RequestGuestAdmission
{
    public function __construct(
        private readonly GuestAccess $access,
        private readonly VideoRooms $rooms,
        private readonly RoomEvents $events,
    ) {}

    /**
     * @throws GuestAccessException when the link / meeting / window does not allow it
     */
    public function handle(MeetingParticipant $guest, ?string $name, ?string $ip, ?CarbonImmutable $now = null): GuestState
    {
        $now ??= CarbonImmutable::now();
        $clean = GuestNames::clean($name);
        $notify = null;

        $state = DB::transaction(function () use ($guest, $clean, $ip, $now, &$notify): GuestState {
            /** @var MeetingParticipant $row */
            $row = MeetingParticipant::query()->whereKey($guest->id)->lockForUpdate()->firstOrFail();
            $row->setRelation('meeting', $guest->meeting);
            $state = $this->access->inspect($row, $now);

            $this->assertUsable($state);
            $occurrence = $state->occurrence;
            assert($occurrence !== null);

            if ($state->status === LobbyStatus::None->value) {
                if ($clean === null) {
                    throw new GuestAccessException('nama_kosong', 'Isi nama Anda (minimal 2 huruf).', 422);
                }

                $row->forceFill([
                    'guest_name' => $clean,
                    'lobby_status' => LobbyStatus::Waiting,
                    'lobby_occurrence_date' => $occurrence->date,
                    'lobby_requested_at' => $now,
                    'lobby_requests' => $row->lobby_requests + 1,
                    'lobby_ip' => $ip !== null ? mb_substr($ip, 0, 45) : null,
                    'admitted_at' => null,
                    'admitted_by' => null,
                    'denied_at' => null,
                    'denied_by' => null,
                    'removed_at' => null,
                    'removed_by' => null,
                    'joined_at' => null,
                ])->save();
                $notify = $occurrence;
            } elseif ($state->status === LobbyStatus::Waiting->value && $clean !== null && $clean !== $row->guest_name) {
                // Typo fixed while waiting.
                $row->forceFill(['guest_name' => $clean])->save();
                $notify = $occurrence;
            }

            return $this->access->inspect($row, $now);
        });

        if ($notify !== null) {
            $this->events->lobbyUpdated($notify, $this->waitingCount($guest, $notify->date));
        }

        return $state;
    }

    private function assertUsable(GuestState $state): void
    {
        match (true) {
            $state->status === 'closed' => throw GuestAccessException::closed(),
            $state->status === 'expired' => throw GuestAccessException::expired(),
            $state->window === 'early' && $state->occurrence !== null => throw GuestAccessException::notYet($this->rooms->opensAt($state->occurrence)),
            default => null,
        };
    }

    private function waitingCount(MeetingParticipant $guest, string $date): int
    {
        return MeetingParticipant::query()
            ->where('meeting_id', $guest->meeting_id)
            ->where('lobby_status', LobbyStatus::Waiting->value)
            ->whereDate('lobby_occurrence_date', $date)
            ->count();
    }
}
