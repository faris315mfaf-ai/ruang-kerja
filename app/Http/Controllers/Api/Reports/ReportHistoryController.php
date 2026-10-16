<?php

namespace App\Http\Controllers\Api\Reports;

use App\Domain\Reports\Queries\MonthlyReportCalendar;
use App\Domain\Reports\Queries\MyDailyReports;
use App\Domain\Reports\Queries\ReportPresenter;
use App\Domain\Reports\Support\ReportDay;
use App\Http\Controllers\Controller;
use App\Models\DailyReport;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Riwayat laporan harian of the Android app (Bagian 4 / B4-C): my month
 * (MonthlyReportCalendar over the schedule), one report I may read
 * (DailyReportPolicy::view — own, or a sent report of someone I read; else
 * 404) and the sent reports of a colleague I read (viewReportsOf, as the web
 * /laporan/{user}). Contract: docs/sesi/ponsel-b4c-laporan.md.
 */
class ReportHistoryController extends Controller
{
    public function __construct(private readonly MyDailyReports $mine) {}

    /**
     * `?bulan=YYYY-MM` (default: the current office month).
     */
    public function index(Request $request, #[CurrentUser] User $user, MonthlyReportCalendar $calendar): JsonResponse
    {
        Gate::authorize('create', DailyReport::class);

        $month = $request->query('bulan');
        $current = substr(ReportDay::today(), 0, 7);

        if ($month === null || $month === '') {
            $month = $current;
        }

        if (! is_string($month) || preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $month) !== 1 || $month > $current) {
            $message = 'Bulan harus berformat YYYY-MM dan tidak melewati bulan ini.';

            return response()->json(['message' => $message, 'errors' => ['bulan' => [$message]]], 422);
        }

        return response()->json([
            ...$calendar->for($user, $month),
            'hari_ini' => $this->mine->status($user),
        ]);
    }

    public function show(DailyReport $dailyReport, #[CurrentUser] User $viewer): JsonResponse
    {
        $dailyReport->loadMissing(['user.position:id,name', 'user.division:id,name']);
        Gate::authorize('view', $dailyReport);

        $owner = $dailyReport->user;
        $mine = $viewer->is($owner);
        $locked = $dailyReport->report_date->toDateString() !== ReportDay::today();

        return response()->json([
            'owner' => ReportPresenter::person($owner),
            'mine' => $mine,
            'report' => [...$this->mine->detail($dailyReport, $viewer), 'locked' => $locked],
            'can' => ['edit' => $mine && ! $locked],
        ]);
    }

    /**
     * Sent reports of a colleague I read (newest first, 60). Own: my full list.
     */
    public function person(User $user, #[CurrentUser] User $viewer): JsonResponse
    {
        Gate::authorize('viewReportsOf', [DailyReport::class, $user]);

        $user->loadMissing(['position:id,name', 'division:id,name']);

        return response()->json([
            'owner' => ReportPresenter::person($user),
            'mine' => $viewer->is($user),
            'reports' => $this->mine->history($user, $viewer),
        ]);
    }
}
