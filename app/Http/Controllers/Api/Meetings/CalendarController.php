<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Queries\CalendarFeed;
use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/kalender?bulan=YYYY-MM — the token owner's personal calendar,
 * the same CalendarFeed as the web /kalender page: the weeks covering the
 * month (Monday before the 1st … Sunday after the last day) with meetings
 * the viewer can see (series expanded), open task deadlines, approved
 * leave/permits/sick/business trips and company holidays as flat entries
 * the app groups by `date`. An invalid month falls back to the running
 * month, like the web.
 */
class CalendarController extends Controller
{
    public function __invoke(Request $request, #[CurrentUser] User $user, CalendarFeed $feed): JsonResponse
    {
        Gate::authorize('viewAny', Meeting::class);

        $now = CarbonImmutable::now(config()->string('app.office_timezone'));
        $month = $request->query('bulan');
        [$year, $number] = is_string($month) && preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $month, $match) === 1
            ? [(int) $match[1], (int) $match[2]]
            : [$now->year, $now->month];

        return response()->json([
            'year' => $year,
            'month' => $number,
            ...$feed->forMonth($user, $year, $number),
        ]);
    }
}
