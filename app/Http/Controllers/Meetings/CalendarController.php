<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Queries\CalendarFeed;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /kalender?bulan=YYYY-MM (F2-3): meetings, task deadlines, approved leave
 * and holidays of the weeks covering a month. Google Calendar sync is on hold.
 */
class CalendarController extends Controller
{
    public function __invoke(Request $request, #[CurrentUser] User $user, CalendarFeed $feed): Response
    {
        Gate::authorize('viewAny', Meeting::class);

        $now = CarbonImmutable::now(CurrentCompany::timezone());
        $month = $request->query('bulan');
        [$year, $number] = is_string($month) && preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $month, $match) === 1
            ? [(int) $match[1], (int) $match[2]]
            : [$now->year, $now->month];

        return Inertia::render('meetings/calendar', [
            'calendar' => [
                'year' => $year,
                'month' => $number,
                ...$feed->forMonth($user, $year, $number),
            ],
        ]);
    }
}
