<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\MinutesStore;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\MeetingSummary;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Models\Meeting;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/rapat/{meeting}/notulen?tanggal=Y-m-d — the full minutes of
 * one occurrence for the mobile app, read-only: attendance, sections,
 * decisions and follow-ups come from the web MeetingPresenter, the people
 * the minutes mention from MeetingFeed::people, so editing/finalizing
 * stays on the web. Visibility follows the web minutes page exactly
 * (MeetingPolicy::view): everyone who may open the meeting may read its
 * minutes, anyone else — workspace member or outsider — gets a 404 that
 * never reveals the content. Minutes that were never written answer a
 * blank draft (id null), like the web page.
 */
class MinutesController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly MinutesStore $store,
        private readonly MeetingPresenter $presenter,
    ) {}

    public function show(Request $request, Meeting $meeting, #[CurrentUser] User $user, MeetingPolicy $policy, MeetingFeed $feed): JsonResponse
    {
        Gate::authorize('view', $meeting);

        $meeting->loadMissing(['participants', 'workspace:id,key,name']);

        // Minutes resolve like the web minutes page: the requested date, else
        // the latest occurrence that has started, else the first upcoming.
        $occurrence = $this->occurrences->resolveForMinutes($meeting, $this->occurrenceDate($request));
        $minutes = $this->store->find($occurrence)?->load('actionItems.task.workspace:id,key');

        $names = MeetingSummary::names([
            $meeting->organizer_id,
            $meeting->minute_taker_id,
            ...$meeting->participants->pluck('user_id')->all(),
        ]);
        $today = CarbonImmutable::now()->setTimezone(config()->string('app.office_timezone'))->toDateString();

        return response()->json([
            'meeting' => MeetingSummary::detail($occurrence, $minutes, $user, $policy, $names, $today),
            'notulen' => $this->presenter->minutes($occurrence, $minutes),
            'people' => $feed->people([$occurrence], $minutes !== null ? [$minutes] : [], [$user->id]),
        ]);
    }

    /** Optional occurrence date of a series (?tanggal=Y-m-d); invalid values resolve like the web. */
    private function occurrenceDate(Request $request): ?string
    {
        $date = $request->query('tanggal');

        return is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1 ? $date : null;
    }
}
