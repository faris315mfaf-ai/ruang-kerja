<?php

namespace App\Domain\Meetings\Guests\Queries;

use App\Domain\Meetings\Guests\GuestState;
use App\Domain\Meetings\Services\VideoRooms;

/**
 * What the public guest page may know (GET /api/tamu/{token}/info and the
 * props of /tamu/{token}). Strictly the guest's own meeting: title, time,
 * organizer's name, window and the guest's waiting-room status — no agenda,
 * description, other participants, workspace or minutes. When the link or the
 * meeting is over (`expired`, `closed`) not even the title is shown.
 */
final class GuestPortal
{
    /** Seconds between two status polls of the waiting room. */
    public const int POLL_SECONDS = 3;

    public function __construct(private readonly VideoRooms $rooms) {}

    /**
     * @return array<string, mixed>
     */
    public function info(GuestState $state): array
    {
        $occurrence = $state->occurrence;
        $live = $state->live() && $occurrence !== null;

        return [
            'status' => $state->status,
            'status_label' => self::label($state->status),
            'window' => $live ? [
                'state' => $state->window,
                'opens_at' => $this->rooms->opensAt($occurrence)->toIso8601ZuluString(),
                'closes_at' => $this->rooms->closesAt($occurrence)->toIso8601ZuluString(),
            ] : null,
            'meeting' => $live ? [
                'title' => $occurrence->meeting->title,
                'starts_at' => $occurrence->startsAt->toIso8601ZuluString(),
                'ends_at' => $occurrence->endsAt->toIso8601ZuluString(),
                'occurrence_date' => $occurrence->date,
                'organizer_name' => $occurrence->meeting->organizer->name,
            ] : null,
            'guest' => ['name' => $state->participant->guest_name],
            'features' => ['video_configured' => $this->rooms->configured()],
            'poll_seconds' => self::POLL_SECONDS,
            'notice_points' => [
                'Anda masuk sebagai tamu: video, suara, berbagi layar, dan obrolan rapat.',
                'Suara dan video Anda tidak direkam dan tidak ditranskrip.',
                'Penyelenggara mencatat nama, alamat IP, dan waktu masuk Anda.',
            ],
        ];
    }

    /**
     * @return array{status: string, status_label: string, window: string|null}
     */
    public function status(GuestState $state): array
    {
        return ['status' => $state->status, 'status_label' => self::label($state->status), 'window' => $state->live() ? $state->window : null];
    }

    public static function label(string $status): string
    {
        return match ($status) {
            'none' => 'Belum masuk',
            'waiting' => 'Menunggu diizinkan penyelenggara',
            'admitted' => 'Diizinkan masuk',
            'denied' => 'Penyelenggara menolak permintaan Anda',
            'removed' => 'Penyelenggara mengeluarkan Anda dari rapat',
            'expired' => 'Tautan sudah kedaluwarsa',
            'closed' => 'Rapat sudah selesai atau dibatalkan',
            default => 'Tidak dikenal',
        };
    }
}
