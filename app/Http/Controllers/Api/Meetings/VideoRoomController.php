<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Actions\CallMeetingParticipant;
use App\Domain\Meetings\Actions\IssueVideoToken;
use App\Domain\Meetings\Actions\MuteVideoParticipant;
use App\Domain\Meetings\Actions\ReadmitVideoParticipant;
use App\Domain\Meetings\Actions\RemoveVideoParticipant;
use App\Domain\Meetings\Actions\ReportSpeakingTime;
use App\Domain\Meetings\Actions\SetOwnAttributes;
use App\Domain\Meetings\Actions\SetRaisedHand;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Guests\Actions\DecideGuestAdmission;
use App\Domain\Meetings\Guests\Actions\IssueGuestVideoToken;
use App\Domain\Meetings\Guests\GuestAccessException;
use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Meetings\Queries\SpeakingTimes;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\NotulenBridge;
use App\Domain\Meetings\Services\VideoRooms;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Meetings\VideoModerationApiRequest;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Meetings\OwnAttributesRequest;
use App\Http\Requests\Meetings\RaiseHandRequest;
use App\Http\Requests\Meetings\ReportSpeakingTimeRequest;
use App\Http\Resources\Meetings\RoomPresenter;
use App\Http\Resources\Meetings\VideoPresenter;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\MeetingVideoRemoval;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use RuntimeException;

/**
 * Video RuangKerja for the native app (B4-B, docs/fitur/rapat-kalender.md
 * §6a, docs/fitur/rapat-video-kontrak.md). Same Actions and MeetingPolicy
 * abilities as the web MeetingVideoController / MeetingRoomController:
 * openVideo (invited, platform video), joinVideo (join window 15 min before
 * until 2 h after; organizer any time; removed people blocked),
 * moderateVideo (organizer), callParticipant (organizer / minute taker).
 * LiveKit not configured → 503 {code: video_belum_siap}. Chat and captions
 * travel over LiveKit itself (no backend); the raised hand and the
 * collaborator-presence attribute are set server-side because tokens carry
 * no canUpdateOwnMetadata (audit R-05).
 */
class VideoRoomController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly VideoRooms $rooms,
    ) {}

    /** GET …/video/ruang?tanggal= — pre-join / room data (web RoomPresenter + notulen summary). */
    public function room(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, RoomPresenter $presenter): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);

        $occurrence = $this->occurrence($request, $meeting);
        $notulen = app(NotulenBridge::class)->summary($occurrence, $user);

        return response()->json([
            'room' => $presenter->room($occurrence, $user, $notulen),
            'notulen' => $notulen,
        ])->header('Cache-Control', 'no-store');
    }

    /** POST …/video/token?tanggal= — LiveKit access token (10 minutes) for one occurrence. */
    public function token(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, IssueVideoToken $issue, MeetingPolicy $policy, MeetingFeed $feed): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);

        if (! $this->rooms->configured()) {
            return $this->notReady();
        }

        $occurrence = $this->occurrence($request, $meeting);
        $join = $policy->joinVideo($user, $meeting, $occurrence);

        if ($join->denied()) {
            return response()->json([
                'message' => $join->message(),
                'code' => $this->deniedCode($user, $occurrence),
                'opens_at' => $this->rooms->opensAt($occurrence)->toIso8601ZuluString(),
                'closes_at' => $this->rooms->closesAt($occurrence)->toIso8601ZuluString(),
            ], 403);
        }

        $role = match (true) {
            $policy->isOrganizer($user, $meeting) => 'organizer',
            $meeting->minute_taker_id === $user->id => 'minute_taker',
            default => 'participant',
        };

        return response()->json([
            ...$issue->handle($user, $occurrence),
            'occurrence_date' => $occurrence->date,
            'role' => $role,
            'can' => [
                'moderate' => $policy->moderateVideo($user, $meeting)->allowed(),
                'call_participants' => $policy->callParticipant($user, $meeting)->allowed(),
                'edit_minutes' => $policy->canWriteMinutes($user, $meeting),
            ],
            // Names/avatars by LiveKit identity (= user id): never trust participant names from LiveKit.
            'people' => $feed->people([$occurrence], [], [$user->id]),
        ])->header('Cache-Control', 'no-store');
    }

    public function mute(VideoModerationApiRequest $request, Meeting $meeting, #[CurrentUser] User $user, MuteVideoParticipant $mute): JsonResponse
    {
        return $this->moderate($request, $meeting, fn (Occurrence $occurrence) => $mute->handle($user, $occurrence, $request->userId(), $request->trackSid()));
    }

    public function remove(VideoModerationApiRequest $request, Meeting $meeting, #[CurrentUser] User $user, RemoveVideoParticipant $remove): JsonResponse
    {
        return $this->moderate($request, $meeting, fn (Occurrence $occurrence) => $remove->handle($user, $occurrence, $request->userId()));
    }

    /** "Izinkan masuk lagi" after a removal (organizer, audit R-04). */
    public function readmit(VideoModerationApiRequest $request, Meeting $meeting, #[CurrentUser] User $user, ReadmitVideoParticipant $readmit, DecideGuestAdmission $decide): JsonResponse
    {
        Gate::authorize('moderateVideo', $meeting);

        // A removed external guest comes back through the waiting room decision.
        $guestId = IssueGuestVideoToken::participantId($request->userId());

        if ($guestId !== null) {
            $guest = MeetingParticipant::query()->whereKey($guestId)->where('meeting_id', $meeting->id)->whereNull('user_id')->firstOrFail();

            try {
                $decide->handle($user, $meeting, $guest, true);
            } catch (GuestAccessException $exception) {
                return response()->json(['message' => $exception->getMessage(), 'code' => $exception->reason], $exception->status);
            }

            return response()->json(['readmitted' => true]);
        }

        return response()->json(['readmitted' => $readmit->handle($user, $this->occurrence($request, $meeting), $request->userId())]);
    }

    /** POST …/video/tangan {raised} — own raised hand (attribute `hand`, server clock). */
    public function hand(RaiseHandRequest $request, Meeting $meeting, #[CurrentUser] User $user, SetRaisedHand $hand): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('joinVideo', [$meeting, $occurrence]);

        if (! $this->rooms->configured()) {
            return $this->notReady();
        }

        try {
            $value = $hand->handle($user, $occurrence, $request->boolean('raised'));
        } catch (RuntimeException $exception) {
            Log::warning('LiveKit raise hand failed', ['meeting' => $meeting->id, 'error' => $exception->getMessage()]);

            return $this->unreachable();
        }

        return response()->json(['hand' => $value]);
    }

    /** POST …/video/atribut {attributes: {hand?, rk_minutes_at?}} — own whitelisted attributes. */
    public function attributes(OwnAttributesRequest $request, Meeting $meeting, #[CurrentUser] User $user, SetOwnAttributes $set): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('joinVideo', [$meeting, $occurrence]);

        if (! $this->rooms->configured()) {
            return $this->notReady();
        }

        /** @var array<string, mixed> $attributes */
        $attributes = (array) $request->input('attributes', []);

        try {
            $applied = $set->handle($user, $occurrence, $attributes);
        } catch (RuntimeException $exception) {
            Log::warning('LiveKit attributes failed', ['meeting' => $meeting->id, 'error' => $exception->getMessage()]);

            return $this->unreachable();
        }

        return response()->json(['attributes' => $applied]);
    }

    /** GET …/video/waktu-bicara — totals + own stored value (seed of the client counter). */
    public function speaking(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, SpeakingTimes $speaking): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);

        return response()->json($speaking->forViewer($this->occurrence($request, $meeting), $user->id))
            ->header('Cache-Control', 'no-store');
    }

    /** POST …/video/waktu-bicara {ms} — own cumulative speaking time (every 15 s). */
    public function reportSpeaking(ReportSpeakingTimeRequest $request, Meeting $meeting, #[CurrentUser] User $user, ReportSpeakingTime $report, SpeakingTimes $speaking): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('joinVideo', [$meeting, $occurrence]);

        $accepted = $report->handle($occurrence, $user, $request->milliseconds());

        return response()->json([...$speaking->forViewer($occurrence, $user->id), 'accepted_ms' => $accepted])
            ->header('Cache-Control', 'no-store');
    }

    /** GET …/video/kehadiran — Kehadiran panel (VideoAttendance roster + count in the room). */
    public function attendance(OccurrenceRequest $request, Meeting $meeting, VideoAttendance $attendance, VideoPresenter $video): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);
        $occurrence = $this->occurrence($request, $meeting);

        return response()->json($video->attendance($occurrence, $attendance->roster($occurrence)))
            ->header('Cache-Control', 'no-store');
    }

    /** POST …/video/panggil/{user} — "Panggil" an invited person who is not in the room (1×/minute). */
    public function call(OccurrenceRequest $request, Meeting $meeting, User $target, #[CurrentUser] User $user, CallMeetingParticipant $call): JsonResponse
    {
        Gate::authorize('callParticipant', $meeting);
        $occurrence = $this->occurrence($request, $meeting);

        try {
            $at = $call->handle($occurrence, $user, $target);
        } catch (ThrottleRequestsException $exception) {
            $retry = (int) ($exception->getHeaders()['Retry-After'] ?? 60);

            return response()->json(['message' => $exception->getMessage(), 'retry_after' => $retry], 429)
                ->header('Retry-After', (string) $retry);
        }

        return response()->json([
            'called' => ['user_id' => $target->id, 'called_at' => $at->toIso8601ZuluString(), 'called_by' => $user->id],
        ]);
    }

    /**
     * @param  callable(Occurrence): void  $action
     */
    private function moderate(VideoModerationApiRequest $request, Meeting $meeting, callable $action): JsonResponse
    {
        Gate::authorize('moderateVideo', $meeting);

        if (! $this->rooms->configured()) {
            return $this->notReady();
        }

        try {
            $action($this->occurrence($request, $meeting));
        } catch (InvalidArgumentException) {
            return response()->json(['message' => 'Pakai tombol di bilah kontrol untuk diri Anda sendiri.'], 422);
        } catch (RuntimeException $exception) {
            Log::warning('LiveKit moderation failed', ['meeting' => $meeting->id, 'error' => $exception->getMessage()]);

            return $this->unreachable();
        }

        return response()->json(['ok' => true]);
    }

    /** Machine-readable reason of a refused token (the message is the policy's). */
    private function deniedCode(User $user, Occurrence $occurrence): string
    {
        $removed = MeetingVideoRemoval::query()
            ->where('meeting_id', $occurrence->meeting->id)
            ->where('occurrence_date', $occurrence->date)
            ->where('user_id', $user->id)
            ->exists();

        if ($removed) {
            return 'dikeluarkan';
        }

        return match ($this->rooms->windowState($occurrence)) {
            'early' => 'ruang_belum_dibuka',
            'closed' => 'ruang_ditutup',
            default => 'tidak_diizinkan',
        };
    }

    private function notReady(): JsonResponse
    {
        return response()->json([
            'message' => 'Video RuangKerja belum disiapkan di server ini. Hubungi admin.',
            'code' => 'video_belum_siap',
        ], 503);
    }

    private function unreachable(): JsonResponse
    {
        return response()->json(['message' => 'Server rapat tidak menjawab. Coba lagi.', 'code' => 'server_rapat_gagal'], 502);
    }

    private function occurrence(OccurrenceRequest|ReportSpeakingTimeRequest $request, Meeting $meeting): Occurrence
    {
        $meeting->loadMissing(['participants', 'workspace:id,key,name']);

        return $this->occurrences->resolve($meeting, $request->occurrenceDate());
    }
}
