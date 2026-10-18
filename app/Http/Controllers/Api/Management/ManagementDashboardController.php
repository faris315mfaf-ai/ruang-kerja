<?php

namespace App\Http\Controllers\Api\Management;

use App\Domain\Analytics\Queries\ManagementDashboard;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Monitoring\Queries\ManagementNotes;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\MeetingSummary;
use App\Models\Meeting;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Dashboard Manajemen of the Android app (Bagian 5 / B5-A): the web
 * /manajemen (ManagementDashboard) split into the same blocks the web defers,
 * so the app paints the shell first and skeletons per block. Gate
 * `viewManagementDashboard` (`dashboard.view_company`: Direksi, HR, Super
 * Admin; others 403). "Jadwal terdekat" = upcoming leadership meetings the
 * viewer may see (keputusan pemilik 13 Okt 2026; empty while the meetings
 * feature is off).
 */
class ManagementDashboardController extends Controller
{
    public const int SCHEDULE_DAYS = 14;

    public const int SCHEDULE_SIZE = 5;

    public function __construct(private readonly ManagementDashboard $dashboard) {}

    public function index(#[CurrentUser] User $user, DashboardAccess $access, ManagementNotes $notes, MeetingFeed $feed, MeetingPolicy $policy): JsonResponse
    {
        Gate::authorize('viewManagementDashboard');

        $now = CarbonImmutable::now();

        return response()->json([
            ...$this->dashboard->header($user, $now),
            'can' => [
                // "Semua proyek" opens the portfolio only for those who may (not HR).
                'portfolio' => $access->canSeePortfolio($user),
                'notes' => true,
                'schedule' => (bool) config('features.meetings'),
            ],
            'notes' => $notes->for($user, $now),
            'schedule' => $this->upcoming($user, $now, $feed, $policy),
        ]);
    }

    /** Hero, KPI tiles and chart of the three periods (harian · mingguan · bulanan) + today's attendance. */
    public function summary(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewManagementDashboard');

        return response()->json($this->dashboard->summary($user, CarbonImmutable::now()));
    }

    /** Active projects, "perlu perhatian" and this month's milestones. */
    public function portfolio(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewManagementDashboard');

        return response()->json($this->dashboard->portfolio($user, CarbonImmutable::now()));
    }

    /** Beban kerja per division → per person (busiest first). */
    public function workload(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewManagementDashboard');

        return response()->json($this->dashboard->workload($user, CarbonImmutable::now()));
    }

    public function schedule(#[CurrentUser] User $user, MeetingFeed $feed, MeetingPolicy $policy): JsonResponse
    {
        Gate::authorize('viewManagementDashboard');

        return response()->json(['schedule' => $this->upcoming($user, CarbonImmutable::now(), $feed, $policy)]);
    }

    /**
     * Leadership meeting occurrences that have not ended yet, within
     * SCHEDULE_DAYS, earliest first (the agenda row of GET /rapat).
     *
     * @return list<array<string, mixed>>
     */
    private function upcoming(User $user, CarbonImmutable $now, MeetingFeed $feed, MeetingPolicy $policy): array
    {
        if (! config('features.meetings')) {
            return [];
        }

        $timezone = CurrentCompany::timezone();
        $today = $now->setTimezone($timezone);

        $occurrences = $feed->occurrences(
            Meeting::query()->visibleTo($user)->active()->where('meetings.leadership', true),
            $today->startOfDay()->utc(),
            $today->startOfDay()->addDays(self::SCHEDULE_DAYS)->utc(),
        )
            ->filter(fn (Occurrence $occurrence): bool => $occurrence->endsAt->gt($now))
            ->sortBy(fn (Occurrence $occurrence): string => $occurrence->startsAt->toIso8601ZuluString())
            ->take(self::SCHEDULE_SIZE)
            ->values();

        $minutes = $feed->minutesFor($occurrences);
        $names = MeetingSummary::namesFor($occurrences);

        return array_values($occurrences
            ->map(fn (Occurrence $occurrence): array => MeetingSummary::agenda($occurrence, $minutes[$occurrence->key()] ?? null, $user, $policy, $names, $today->toDateString()))
            ->all());
    }
}
