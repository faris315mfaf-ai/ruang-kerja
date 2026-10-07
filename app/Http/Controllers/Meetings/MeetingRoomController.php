<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Actions\CallMeetingParticipant;
use App\Domain\Meetings\Actions\ChooseMinutesSource;
use App\Domain\Meetings\Actions\ReportSpeakingTime;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\PreviousMinutes;
use App\Domain\Meetings\Queries\SpeakingTimes;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\MinutesStore;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\ChooseMinutesSourceRequest;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Meetings\ReportSpeakingTimeRequest;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Http\Resources\Meetings\RoomPresenter;
use App\Http\Resources\Meetings\VideoPresenter;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * JSON endpoints of the "Notulen Hidup" video room
 * (docs/fitur/rapat-video-kontrak.md §2–4): notes source chosen on the
 * pre-join screen, speaking time (report own / read all), the Kehadiran
 * panel and "Panggil". Every endpoint takes ?tanggal= for one occurrence of
 * a series; an invisible meeting is 404 (MeetingRequest).
 */
class MeetingRoomController extends Controller
{
    public function __construct(private readonly MeetingOccurrences $occurrences) {}

    public function notesSource(ChooseMinutesSourceRequest $request, Meeting $meeting, #[CurrentUser] User $user, ChooseMinutesSource $choose, MinutesStore $store, PreviousMinutes $previous, RoomPresenter $room, MeetingPresenter $presenter): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('editMinutes', [$meeting, $store->find($occurrence)]);

        $result = $choose->handle($occurrence, $user, $request->source());
        $minutes = $result['minutes']->fresh() ?? $result['minutes'];
        $minutes->load('actionItems.task.workspace:id,key');

        return response()->json([
            'applied' => $result['applied'],
            'notes_source' => $room->notesSource($occurrence, $minutes, $previous->for($occurrence), false),
            'minutes' => $presenter->minutes($occurrence, $minutes),
        ]);
    }

    public function speaking(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, SpeakingTimes $speaking): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);

        return response()->json($speaking->forViewer($this->occurrence($request, $meeting), $user->id))
            ->header('Cache-Control', 'no-store');
    }

    public function reportSpeaking(ReportSpeakingTimeRequest $request, Meeting $meeting, #[CurrentUser] User $user, ReportSpeakingTime $report, SpeakingTimes $speaking): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('joinVideo', [$meeting, $occurrence]);

        $accepted = $report->handle($occurrence, $user, $request->milliseconds());

        return response()->json([...$speaking->forViewer($occurrence, $user->id), 'accepted_ms' => $accepted])
            ->header('Cache-Control', 'no-store');
    }

    public function attendance(OccurrenceRequest $request, Meeting $meeting, VideoAttendance $attendance, VideoPresenter $video): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);
        $occurrence = $this->occurrence($request, $meeting);

        return response()->json($video->attendance($occurrence, $attendance->roster($occurrence)))
            ->header('Cache-Control', 'no-store');
    }

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

    private function occurrence(OccurrenceRequest|ChooseMinutesSourceRequest|ReportSpeakingTimeRequest $request, Meeting $meeting): Occurrence
    {
        $meeting->loadMissing(['participants', 'workspace:id,key,name']);

        return $this->occurrences->resolve($meeting, $request->occurrenceDate());
    }
}
