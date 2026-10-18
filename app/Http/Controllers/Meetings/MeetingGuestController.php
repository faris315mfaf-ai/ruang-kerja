<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Guests\Actions\AddMeetingGuest;
use App\Domain\Meetings\Guests\Actions\DecideGuestAdmission;
use App\Domain\Meetings\Guests\Actions\RevokeMeetingGuest;
use App\Domain\Meetings\Guests\Actions\RotateGuestLink;
use App\Domain\Meetings\Guests\GuestAccessException;
use App\Domain\Meetings\Guests\Queries\GuestRoster;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\VideoRooms;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Meetings\StoreMeetingGuestRequest;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * External guests of a video meeting, for the people who run it
 * (docs/sesi/rapat-tamu-eksternal.md). The same controller serves the web
 * (/rapat/{id}/tamu…) and the mobile API (/api/v1/rapat/{id}/tamu…).
 *
 * - guest list with copyable links, add, rotate, revoke: organizer
 *   (MeetingPolicy::manageGuests);
 * - waiting room list / admit / deny: organizer, minute taker, internal
 *   participants (MeetingPolicy::manageLobby).
 * A meeting nobody may see is 404 before anything else (MeetingRequest).
 * Responses are never cached (they hold personal links or names).
 */
class MeetingGuestController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly VideoRooms $rooms,
        private readonly GuestRoster $roster,
    ) {}

    /** GET …/tamu — the guest list with links (organizer). */
    public function index(OccurrenceRequest $request, Meeting $meeting): JsonResponse
    {
        Gate::authorize('manageGuests', $meeting);
        $occurrence = $this->occurrence($request, $meeting);

        return $this->json([
            'occurrence_date' => $occurrence->date,
            'window' => $this->window($occurrence),
            'limit' => AddMeetingGuest::MAX_GUESTS,
            'guests' => $this->roster->guests($occurrence),
        ]);
    }

    /** POST …/tamu {email, name?} — invite a guest (organizer); 201 with the guest. */
    public function store(StoreMeetingGuestRequest $request, Meeting $meeting, #[CurrentUser] User $user, AddMeetingGuest $add): JsonResponse
    {
        Gate::authorize('manageGuests', $meeting);
        $email = mb_strtolower($request->string('email')->trim()->toString());
        $known = MeetingParticipant::query()->where('meeting_id', $meeting->id)->where('email', $email)->exists();

        if (! $known && MeetingParticipant::query()->where('meeting_id', $meeting->id)->whereNull('user_id')->count() >= AddMeetingGuest::MAX_GUESTS) {
            return response()->json(['message' => 'Maksimal '.AddMeetingGuest::MAX_GUESTS.' tamu per rapat.', 'code' => 'terlalu_banyak_tamu'], 422);
        }

        $guest = $add->handle($user, $meeting, $email, $request->guestName());

        return $this->json(['guest' => $this->roster->item($this->occurrence($request, $meeting), $guest)], $known ? 200 : 201);
    }

    /** POST …/tamu/{participant}/putar — a new link; the old one dies at once (organizer). */
    public function rotate(OccurrenceRequest $request, Meeting $meeting, string $participant, #[CurrentUser] User $user, RotateGuestLink $rotate): JsonResponse
    {
        Gate::authorize('manageGuests', $meeting);
        $guest = $rotate->handle($user, $meeting, $this->guest($meeting, $participant));

        return $this->json(['guest' => $this->roster->item($this->occurrence($request, $meeting), $guest)]);
    }

    /** DELETE …/tamu/{participant} — revoke the guest altogether (organizer). */
    public function destroy(OccurrenceRequest $request, Meeting $meeting, string $participant, #[CurrentUser] User $user, RevokeMeetingGuest $revoke): JsonResponse
    {
        Gate::authorize('manageGuests', $meeting);
        $revoke->handle($user, $meeting, $this->guest($meeting, $participant));

        return $this->json(['ok' => true]);
    }

    /** GET …/video/ruang-tunggu — who is waiting (everyone invited; poll every ~4 s). */
    public function lobby(OccurrenceRequest $request, Meeting $meeting): JsonResponse
    {
        Gate::authorize('manageLobby', $meeting);
        $occurrence = $this->occurrence($request, $meeting);
        $waiting = $this->roster->waiting($occurrence);

        return $this->json([
            'occurrence_date' => $occurrence->date,
            'window' => $this->window($occurrence),
            'waiting' => $waiting,
            'waiting_count' => count($waiting),
        ]);
    }

    /** POST …/video/ruang-tunggu/{participant}/izinkan — "Izinkan masuk". */
    public function admit(OccurrenceRequest $request, Meeting $meeting, string $participant, #[CurrentUser] User $user, DecideGuestAdmission $decide): JsonResponse
    {
        return $this->decide($request, $meeting, $participant, $user, $decide, true);
    }

    /** POST …/video/ruang-tunggu/{participant}/tolak — "Tolak". */
    public function deny(OccurrenceRequest $request, Meeting $meeting, string $participant, #[CurrentUser] User $user, DecideGuestAdmission $decide): JsonResponse
    {
        return $this->decide($request, $meeting, $participant, $user, $decide, false);
    }

    private function decide(OccurrenceRequest $request, Meeting $meeting, string $participant, User $user, DecideGuestAdmission $decide, bool $admit): JsonResponse
    {
        Gate::authorize('manageLobby', $meeting);
        $guest = $this->guest($meeting, $participant);

        try {
            $guest = $decide->handle($user, $meeting, $guest, $admit);
        } catch (GuestAccessException $exception) {
            return response()->json(['message' => $exception->getMessage(), 'code' => $exception->reason], $exception->status);
        }

        return $this->json([
            'guest' => [
                'id' => $guest->id,
                'name' => $guest->guest_name,
                'status' => $guest->lobby_status->value,
                'status_label' => $guest->lobby_status->label(),
            ],
        ]);
    }

    private function guest(Meeting $meeting, string $id): MeetingParticipant
    {
        return MeetingParticipant::query()
            ->whereKey(strtolower($id))
            ->where('meeting_id', $meeting->id)
            ->whereNull('user_id')
            ->whereNotNull('email')
            ->firstOrFail();
    }

    private function occurrence(OccurrenceRequest $request, Meeting $meeting): Occurrence
    {
        return $this->occurrences->resolve($meeting, $request->occurrenceDate());
    }

    /**
     * @return array{state: string, opens_at: string, closes_at: string}
     */
    private function window(Occurrence $occurrence): array
    {
        return [
            'state' => $this->rooms->windowState($occurrence),
            'opens_at' => $this->rooms->opensAt($occurrence)->toIso8601ZuluString(),
            'closes_at' => $this->rooms->closesAt($occurrence)->toIso8601ZuluString(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function json(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'no-store');
    }
}
