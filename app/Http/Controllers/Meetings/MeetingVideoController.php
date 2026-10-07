<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Actions\IssueVideoToken;
use App\Domain\Meetings\Actions\MuteVideoParticipant;
use App\Domain\Meetings\Actions\RemoveVideoParticipant;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\NotulenBridge;
use App\Domain\Meetings\Services\VideoRooms;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Meetings\VideoModerationRequest;
use App\Http\Resources\Meetings\RoomPresenter;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;
use RuntimeException;

/**
 * Rapat video RuangKerja (docs/fitur/rapat-kalender.md §6a): pre-join screen
 * /rapat/{id}/gabung, full-screen room /rapat/{id}/ruang, LiveKit token,
 * and the organizer's mute / remove. Abilities: MeetingPolicy::openVideo,
 * joinVideo (join window), moderateVideo. When LiveKit is not configured
 * the pages still render (with a note) and the API answers 503. Both pages
 * get the "Notulen Hidup" room props (RoomPresenter) and the automatic
 * minutes summary (`notulen`, NotulenBridge) — contract in
 * docs/fitur/rapat-video-kontrak.md.
 */
class MeetingVideoController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly VideoRooms $rooms,
    ) {}

    public function join(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, RoomPresenter $presenter): Response
    {
        return $this->page('meetings/join', $request, $meeting, $user, $presenter);
    }

    public function room(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, RoomPresenter $presenter): Response
    {
        return $this->page('meetings/room', $request, $meeting, $user, $presenter);
    }

    public function token(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, IssueVideoToken $issue): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);

        if (! $this->rooms->configured()) {
            return response()->json(['message' => 'Video RuangKerja belum disiapkan di server ini. Hubungi admin.'], 503);
        }

        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('joinVideo', [$meeting, $occurrence]);

        return response()->json($issue->handle($user, $occurrence))
            ->header('Cache-Control', 'no-store');
    }

    public function mute(VideoModerationRequest $request, Meeting $meeting, string $identity, #[CurrentUser] User $user, MuteVideoParticipant $mute): JsonResponse
    {
        return $this->moderate($request, $meeting, $user, fn (Occurrence $occurrence) => $mute->handle($user, $occurrence, $identity, $request->trackSid()));
    }

    public function remove(VideoModerationRequest $request, Meeting $meeting, string $identity, #[CurrentUser] User $user, RemoveVideoParticipant $remove): JsonResponse
    {
        return $this->moderate($request, $meeting, $user, fn (Occurrence $occurrence) => $remove->handle($user, $occurrence, $identity));
    }

    /**
     * @param  callable(Occurrence): void  $action
     */
    private function moderate(VideoModerationRequest $request, Meeting $meeting, User $user, callable $action): JsonResponse
    {
        Gate::authorize('moderateVideo', $meeting);

        if (! $this->rooms->configured()) {
            return response()->json(['message' => 'Video RuangKerja belum disiapkan di server ini.'], 503);
        }

        try {
            $action($this->occurrence($request, $meeting));
        } catch (InvalidArgumentException) {
            return response()->json(['message' => 'Pakai tombol di bilah kontrol untuk diri Anda sendiri.'], 422);
        } catch (RuntimeException $exception) {
            Log::warning('LiveKit moderation failed', ['meeting' => $meeting->id, 'error' => $exception->getMessage()]);

            return response()->json(['message' => 'Server rapat tidak menjawab. Coba lagi.'], 502);
        }

        return response()->json(['ok' => true]);
    }

    private function page(string $component, OccurrenceRequest $request, Meeting $meeting, User $user, RoomPresenter $presenter): Response
    {
        Gate::authorize('openVideo', $meeting);

        $meeting->load(['participants', 'workspace:id,key,name']);
        $occurrence = $this->occurrence($request, $meeting);
        $notulen = app(NotulenBridge::class)->summary($occurrence, $user);

        return Inertia::render($component, [
            'room' => $presenter->room($occurrence, $user, $notulen),
            'notulen' => $notulen,
        ]);
    }

    private function occurrence(OccurrenceRequest $request, Meeting $meeting): Occurrence
    {
        return $this->occurrences->resolve($meeting, $request->occurrenceDate());
    }
}
