<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\VideoRooms;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\MeetingSummary;
use App\Models\Meeting;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\Response;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/rapat/{meeting}?tanggal=Y-m-d — one occurrence of a meeting
 * for the mobile app: the full detail (participants with names and RSVP),
 * a minutes teaser (status + whether anything was written) and the viewer's
 * rights. An invisible meeting answers 404 (MeetingPolicy::view), like the
 * web. For platform `video` the `video` block carries the web join link —
 * the app opens the browser for the video room in v1, no LiveKit token is
 * issued through this API.
 */
class MeetingController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly MinutesStore $store,
    ) {}

    public function show(Request $request, Meeting $meeting, #[CurrentUser] User $user, MeetingPolicy $policy): JsonResponse
    {
        Gate::authorize('view', $meeting);

        $meeting->load(['participants', 'workspace:id,key,name']);

        $occurrence = $this->occurrences->resolve($meeting, $this->occurrenceDate($request));
        $minutes = $this->store->find($occurrence);
        $names = MeetingSummary::names([
            $meeting->organizer_id,
            $meeting->minute_taker_id,
            ...$meeting->participants->pluck('user_id')->all(),
        ]);
        $today = CarbonImmutable::now()->setTimezone(config()->string('app.office_timezone'))->toDateString();

        // joinVideo is occurrence-aware (join window, organizer removal).
        $join = $policy->joinVideo($user, $meeting, $occurrence);

        return response()->json([
            'meeting' => MeetingSummary::detail($occurrence, $minutes, $user, $policy, $names, $today),
            'can' => [
                'rsvp' => $policy->respond($user, $meeting)->allowed(),
                'edit' => $policy->update($user, $meeting)->allowed(),
                'join_video' => $join->allowed(),
            ],
            'video' => $this->video($meeting, $occurrence, $join),
        ]);
    }

    /**
     * The built-in video room summary for v1: the web pre-join link (the
     * app opens the browser) plus the join window and the policy verdict.
     *
     * @return array<string, mixed>|null
     */
    private function video(Meeting $meeting, Occurrence $occurrence, Response $join): ?array
    {
        if ($meeting->platform !== MeetingPlatform::Video) {
            return null;
        }

        $rooms = app(VideoRooms::class);

        return [
            'configured' => $rooms->configured(),
            // The app opens the web pre-join page in a browser (v1).
            'join_href' => $occurrence->url('/gabung'),
            'opens_at' => $rooms->opensAt($occurrence)->toIso8601ZuluString(),
            'closes_at' => $rooms->closesAt($occurrence)->toIso8601ZuluString(),
            'can_join' => $join->allowed(),
            'denied_reason' => $join->allowed() ? null : $join->message(),
        ];
    }

    /** Optional occurrence date of a series (?tanggal=Y-m-d); invalid values resolve like the web. */
    private function occurrenceDate(Request $request): ?string
    {
        $date = $request->query('tanggal');

        return is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1 ? $date : null;
    }
}
