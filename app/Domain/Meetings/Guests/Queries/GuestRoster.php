<?php

namespace App\Domain\Meetings\Guests\Queries;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\LobbyStatus;
use App\Domain\Meetings\Guests\Services\GuestAccess;
use App\Domain\Meetings\Guests\Services\GuestLinks;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;

/**
 * Guest-side data for the people who run the meeting (docs/sesi/
 * rapat-tamu-eksternal.md §3):
 *
 * - `guests()` — the organizer's list with each guest's copyable link and the
 *   status for one occurrence (links are created lazily for older guests);
 * - `waiting()` — the waiting room, for everybody who may admit.
 */
final class GuestRoster
{
    public function __construct(
        private readonly GuestLinks $links,
        private readonly GuestAccess $access,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function guests(Occurrence $occurrence): array
    {
        $meeting = $occurrence->meeting;
        $rows = MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->whereNull('user_id')
            ->whereNotNull('email')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $inRoom = MeetingAttendance::query()
            ->where('meeting_id', $meeting->id)
            ->where('occurrence_date', $occurrence->date)
            ->whereNotNull('participant_id')
            ->whereNull('left_at')
            ->pluck('participant_id')
            ->map(strval(...))
            ->flip();

        return array_values($rows->map(fn (MeetingParticipant $guest): array => $this->shape($guest, $occurrence, isset($inRoom[(string) $guest->id])))->all());
    }

    /**
     * One guest as listed for the organizer (also the answer of "add guest").
     *
     * @return array<string, mixed>
     */
    public function item(Occurrence $occurrence, MeetingParticipant $guest): array
    {
        $inRoom = MeetingAttendance::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->where('occurrence_date', $occurrence->date)
            ->where('participant_id', $guest->id)
            ->whereNull('left_at')
            ->exists();

        return $this->shape($guest, $occurrence, $inRoom);
    }

    /**
     * @return array<string, mixed>
     */
    private function shape(MeetingParticipant $guest, Occurrence $occurrence, bool $inRoom): array
    {
        $this->links->ensure($guest, $occurrence->meeting);
        $status = $this->access->lobbyStatus($guest, $occurrence);
        $concerns = $status !== LobbyStatus::None;

        return [
            'id' => $guest->id,
            'email' => $guest->email,
            'name' => $guest->guest_name,
            'link_url' => $this->links->url($guest),
            'link_expires_at' => $guest->link_expires_at?->toIso8601ZuluString(),
            'link_expired' => $guest->link_expires_at !== null && $guest->link_expires_at->isPast(),
            'link_rotated_at' => $guest->link_rotated_at?->toIso8601ZuluString(),
            'status' => $status->value,
            'status_label' => $status->label(),
            'requested_at' => $concerns ? $guest->lobby_requested_at?->toIso8601ZuluString() : null,
            'admitted_at' => $status === LobbyStatus::Admitted ? $guest->admitted_at?->toIso8601ZuluString() : null,
            'in_room' => $inRoom,
            'identity' => 'guest:'.strtolower((string) $guest->id),
        ];
    }

    /**
     * Guests waiting for the given occurrence, oldest first.
     *
     * @return list<array{id: string, name: string|null, email: string|null, requested_at: string|null, identity: string}>
     */
    public function waiting(Occurrence $occurrence): array
    {
        $rows = MeetingParticipant::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->whereNull('user_id')
            ->where('lobby_status', LobbyStatus::Waiting->value)
            ->whereDate('lobby_occurrence_date', $occurrence->date)
            ->orderBy('lobby_requested_at')
            ->orderBy('id')
            ->get()
            ->map(fn (MeetingParticipant $guest): array => [
                'id' => (string) $guest->id,
                'name' => $guest->guest_name,
                'email' => $guest->email,
                'requested_at' => $guest->lobby_requested_at?->toIso8601ZuluString(),
                'identity' => 'guest:'.strtolower((string) $guest->id),
            ])
            ->all();

        return array_values($rows);
    }
}
