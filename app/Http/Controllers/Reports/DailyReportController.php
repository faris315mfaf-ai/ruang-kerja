<?php

namespace App\Http\Controllers\Reports;

use App\Domain\Reports\Actions\SaveDailyReport;
use App\Domain\Reports\Actions\SubmitDailyReport;
use App\Domain\Reports\Queries\DailyReportFeed;
use App\Domain\Reports\Queries\MyDailyReports;
use App\Domain\Reports\Queries\ReportPresenter;
use App\Domain\Reports\Queries\ReportTaskOptions;
use App\Domain\Reports\Services\ReportReaders;
use App\Domain\Reports\Support\ReportDay;
use App\Http\Controllers\Controller;
use App\Http\Requests\Reports\SaveDailyReportRequest;
use App\Models\DailyReport;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Laporan progres harian (keputusan pemilik 6 Okt 2026): my history and the
 * team of today (/laporan), today's form with autosave and "Kirim"
 * (/laporan/hari-ini), and the reports of a colleague I may read
 * (/laporan/{user}, /laporan/{user}/{date}; DailyReportPolicy, else 404).
 */
class DailyReportController extends Controller
{
    public function __construct(private readonly MyDailyReports $mine) {}

    public function index(#[CurrentUser] User $user, DailyReportFeed $feed, ReportReaders $readers): Response
    {
        Gate::authorize('create', DailyReport::class);

        $user->loadMissing(['position:id,name', 'division:id,name']);

        return Inertia::render('reports/index', [
            'owner' => ReportPresenter::person($user),
            'mine' => true,
            'today' => $this->mine->status($user),
            'reports' => $this->mine->history($user, $user),
            // People whose reports I read (direct reports, my division, everyone for Direksi/HR).
            'team' => $readers->readableUsers($user)->exists()
                ? Inertia::defer(fn (): array => $feed->forDate($user->company_id, ReportDay::today(), $user))
                : null,
        ]);
    }

    public function today(#[CurrentUser] User $user): Response
    {
        Gate::authorize('create', DailyReport::class);

        return Inertia::render('reports/today', [
            ...$this->mine->form($user),
            'locks_at' => ReportDay::locksAt(ReportDay::today())->toIso8601String(),
            'limits' => [
                'items' => SaveDailyReport::MAX_ITEMS,
                'note' => SaveDailyReportRequest::NOTE_MAX,
                'text' => SaveDailyReportRequest::TEXT_MAX,
            ],
        ]);
    }

    /**
     * Autosave of the draft (or of a sent report, until 23.59).
     */
    public function save(SaveDailyReportRequest $form, #[CurrentUser] User $user, SaveDailyReport $save): JsonResponse
    {
        Gate::authorize('create', DailyReport::class);

        $report = $save->handle($user, $form->toInput());

        return response()->json(['report' => $this->mine->detail($report, $user)]);
    }

    public function submit(SaveDailyReportRequest $form, #[CurrentUser] User $user, SubmitDailyReport $submit): JsonResponse
    {
        Gate::authorize('create', DailyReport::class);

        $report = $submit->handle($user, $form->toInput());

        return response()->json([
            'report' => $this->mine->detail($report, $user),
            'message' => 'Laporan hari ini terkirim.',
        ]);
    }

    /**
     * Task picker search (tasks I can see).
     */
    public function tasks(Request $request, #[CurrentUser] User $user, ReportTaskOptions $options): JsonResponse
    {
        Gate::authorize('create', DailyReport::class);

        $term = $request->query('q');

        return response()->json(['tasks' => $options->search($user, is_string($term) ? mb_substr($term, 0, 100) : '')]);
    }

    /**
     * /laporan/{user}: sent reports of a colleague I read (own: redirect to /laporan).
     */
    public function person(#[CurrentUser] User $viewer, User $user): Response|RedirectResponse
    {
        Gate::authorize('viewReportsOf', [DailyReport::class, $user]);

        if ($viewer->is($user)) {
            return to_route('reports.index');
        }

        $user->loadMissing(['position:id,name', 'division:id,name']);

        return Inertia::render('reports/index', [
            'owner' => ReportPresenter::person($user),
            'mine' => false,
            'today' => null,
            'reports' => $this->mine->history($user, $viewer),
            'team' => null,
        ]);
    }

    public function show(#[CurrentUser] User $viewer, User $user, string $date): Response
    {
        abort_unless(ReportDay::isDate($date), 404);

        $report = DailyReport::query()
            ->where('user_id', $user->id)
            ->whereDate('report_date', $date)
            ->with('user')
            ->first();

        abort_if($report === null, 404);
        Gate::authorize('view', $report);

        $user->loadMissing(['position:id,name', 'division:id,name']);

        return Inertia::render('reports/show', [
            'owner' => ReportPresenter::person($user),
            'mine' => $viewer->is($user),
            'report' => $this->mine->detail($report, $viewer),
        ]);
    }
}
