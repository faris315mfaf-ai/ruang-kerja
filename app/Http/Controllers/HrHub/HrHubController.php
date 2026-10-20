<?php

namespace App\Http\Controllers\HrHub;

use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Queries\ManagementDashboard;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Briefings\Queries\BriefingWindow;
use App\Domain\HrHub\Actions\AssignHrTask;
use App\Domain\HrHub\Actions\EnsureHrWorkspaces;
use App\Domain\HrHub\Actions\RemindDailyReport;
use App\Domain\HrHub\Enums\SystemWorkspace;
use App\Domain\HrHub\Queries\HrAssignments;
use App\Domain\HrHub\Queries\HrAttendance;
use App\Domain\HrHub\Queries\HrCalendar;
use App\Domain\HrHub\Queries\HrSummary;
use App\Domain\Monitoring\Queries\DailyWorkMonitor;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Domain\Payroll\Queries\PayrollCalculator;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Http\Requests\HrHub\AssignHrTaskRequest;
use App\Http\Requests\HrHub\RemindDailyReportRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\NotePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Ruang HR (/hr, keputusan pemilik 20 Okt 2026): replaces the HR dashboard
 * for HR and Super Admin (Gate `viewHrHub`, everyone else 403). Six tabs —
 * Ringkasan, Absensi, Monitoring, Penugasan, Jadwal, Catatan — share the
 * `hub` props; every page first makes sure the system workspaces "Tim HR"
 * and "Penugasan HR" exist and follow the HR role (EnsureHrWorkspaces, a
 * no-op when in sync).
 */
class HrHubController extends Controller
{
    /** @var array<string, Workspace>|null */
    private ?array $workspaces = null;

    public function __construct(private readonly EnsureHrWorkspaces $ensure) {}

    public function summary(#[CurrentUser] User $user, HrSummary $summary, BriefingWindow $briefings): Response
    {
        Gate::authorize('viewHrHub');
        $now = CarbonImmutable::now();
        $workspaces = $this->workspaces($user);

        return Inertia::render('hr/summary', [
            'hub' => $this->hub($user, 'ringkasan', $now),
            'channels' => [AttendanceRecorded::companyChannel($user->company_id)],
            'summary' => fn (): array => $summary->for($user, $now, $workspaces),
            // Kartu "Catat briefing" (keputusan pemilik 9 Okt 2026) moved here with the HR dashboard.
            'briefing' => fn (): ?array => $briefings->card($user, $now),
        ]);
    }

    public function attendance(#[CurrentUser] User $user, HrAttendance $attendance, PayrollCalculator $payroll): Response
    {
        Gate::authorize('viewHrHub');
        $now = CarbonImmutable::now();

        return Inertia::render('hr/attendance', [
            'hub' => $this->hub($user, 'absensi', $now),
            'channels' => [AttendanceRecorded::companyChannel($user->company_id)],
            'attendance' => fn (): array => $attendance->for($user, HrSummary::people($user), $now),
            // Absensi › Gaji total of this month (live, not locked) — only with payroll.view.
            'payroll' => Gate::allows('viewAny', PayrollPeriod::class)
                ? Inertia::defer(function () use ($user, $payroll, $now): array {
                    $month = RecapPeriod::normalize(null, $now);
                    $report = $payroll->forMonth($user, RecapPeriod::forMonth($month, $now));

                    return ['month' => $month, 'total' => (int) ($report->totals['total'] ?? 0), 'paid_days' => (int) ($report->totals['paid_days'] ?? 0), 'href' => '/absensi/gaji'];
                })
                : null,
        ]);
    }

    public function monitoring(Request $request, #[CurrentUser] User $user, DailyWorkMonitor $daily, ManagementDashboard $management): Response
    {
        Gate::authorize('viewHrHub');
        $now = CarbonImmutable::now();
        $today = Period::officeDate($now);
        $date = self::pickDate($request->query('tanggal'), $today);
        $view = $request->query('tampil') === 'beban' ? 'beban' : 'laporan';

        return Inertia::render('hr/monitoring', [
            'hub' => $this->hub($user, 'monitoring', $now),
            'monitoring' => [
                'date' => $date->toDateString(),
                'today' => $today->toDateString(),
                'view' => $view,
                'can_remind' => $date->equalTo($today),
            ],
            'daily' => Inertia::defer(fn (): array => $daily->for($user, HrSummary::people($user), $date, $now), 'laporan'),
            'workload' => Inertia::defer(fn (): array => $management->workload($user, $now), 'beban'),
        ]);
    }

    public function assignments(Request $request, #[CurrentUser] User $user, HrAssignments $assignments): Response
    {
        Gate::authorize('viewHrHub');
        $now = CarbonImmutable::now();
        $status = $request->query('status');
        $workspace = $this->workspaces($user)[SystemWorkspace::HrAssignments->value] ?? null;

        return Inertia::render('hr/assignments', [
            'hub' => $this->hub($user, 'penugasan', $now),
            'assignments' => fn (): array => $assignments->list($user, is_string($status) ? $status : null, $now, $workspace),
            'pickers' => Inertia::defer(fn (): array => $assignments->pickers($user), 'pemilih'),
            'limits' => ['recipients' => AssignHrTask::MAX_RECIPIENTS, 'checklist' => AssignHrTask::MAX_CHECKLIST],
        ]);
    }

    public function schedule(Request $request, #[CurrentUser] User $user, HrCalendar $calendar): Response
    {
        Gate::authorize('viewHrHub');
        $now = CarbonImmutable::now();
        $local = $now->setTimezone(CurrentCompany::timezone());
        $month = $request->query('bulan');
        [$year, $number] = is_string($month) && preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $month, $match) === 1
            ? [(int) $match[1], (int) $match[2]]
            : [(int) $local->format('Y'), (int) $local->format('n')];

        return Inertia::render('hr/schedule', [
            'hub' => $this->hub($user, 'jadwal', $now),
            'calendar' => fn (): array => $calendar->forMonth($user, $year, $number, $now),
        ]);
    }

    public function notes(#[CurrentUser] User $user, NoteLibrary $library, NotePolicy $policy): Response
    {
        Gate::authorize('viewHrHub');
        $now = CarbonImmutable::now();
        $team = $this->workspaces($user)[SystemWorkspace::HrTeam->value] ?? null;
        $enabled = (bool) config('features.notes') && $team !== null;

        return Inertia::render('hr/notes', [
            'hub' => $this->hub($user, 'catatan', $now),
            'notes' => [
                'enabled' => $enabled,
                'workspace' => $team === null ? null : ['id' => $team->id, 'key' => $team->key, 'name' => $team->name],
                'items' => $enabled ? $library->notes($user, $team->id) : [],
                'can_create' => $enabled && $policy->create($user, $team)->allowed(),
            ],
        ]);
    }

    public function assign(AssignHrTaskRequest $request, #[CurrentUser] User $user, AssignHrTask $assign): RedirectResponse
    {
        Gate::authorize('viewHrHub');

        $payload = $request->payload();
        $tasks = $assign->handle($user, $payload);
        $count = count($tasks);

        Inertia::flash('toast', ['type' => 'success', 'message' => $payload['mode'] === 'shared'
            ? "Tugas {$tasks[0]->displayKey()} diberikan."
            : "{$count} tugas diberikan."]);

        return back();
    }

    public function remind(RemindDailyReportRequest $request, #[CurrentUser] User $user, RemindDailyReport $remind): RedirectResponse
    {
        Gate::authorize('viewHrHub');

        $result = $remind->handle($user, $request->targets());

        Inertia::flash('toast', $result['sent'] > 0
            ? ['type' => 'success', 'message' => "Pengingat dikirim ke {$result['sent']} orang."]
            : ['type' => 'info', 'message' => 'Tidak ada pengingat baru: semua sudah mengirim laporan atau sudah diingatkan hari ini.']);

        return back();
    }

    /**
     * Header shared by the six tabs.
     *
     * @return array<string, mixed>
     */
    private function hub(User $user, string $tab, CarbonImmutable $now): array
    {
        $local = $now->setTimezone(CurrentCompany::timezone());
        $workspaces = $this->workspaces($user);
        $present = fn (?Workspace $workspace): ?array => $workspace === null ? null : ['id' => $workspace->id, 'key' => $workspace->key, 'name' => $workspace->name];

        return [
            'tab' => $tab,
            'today' => $local->toDateString(),
            'today_label' => $local->locale('id')->translatedFormat('l, j F Y'),
            'workspaces' => [
                'team' => $present($workspaces[SystemWorkspace::HrTeam->value] ?? null),
                'assignments' => $present($workspaces[SystemWorkspace::HrAssignments->value] ?? null),
            ],
            'features' => [
                'meetings' => (bool) config('features.meetings'),
                'notes' => (bool) config('features.notes'),
            ],
        ];
    }

    /**
     * @return array<string, Workspace>
     */
    private function workspaces(User $user): array
    {
        return $this->workspaces ??= $this->ensure->handle($user->company_id);
    }

    /**
     * Office date from `?tanggal=`: a valid date up to today, else today.
     */
    private static function pickDate(mixed $value, CarbonImmutable $today): CarbonImmutable
    {
        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1
            || ! checkdate((int) substr($value, 5, 2), (int) substr($value, 8, 2), (int) substr($value, 0, 4))) {
            return $today;
        }

        $date = CarbonImmutable::createFromFormat('!Y-m-d', $value, $today->getTimezone());

        return $date === null || $date->gt($today) ? $today : $date;
    }
}
