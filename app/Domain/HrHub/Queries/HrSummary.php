<?php

namespace App\Domain\HrHub\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Services\HiringAccess;
use App\Domain\HrHub\Enums\SystemWorkspace;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Candidate;
use App\Models\DailyReport;
use App\Models\Note;
use App\Models\PasswordResetRequest;
use App\Models\RequestApproval;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/**
 * Ruang HR › Ringkasan (keputusan pemilik 20 Okt 2026): today's numbers,
 * what waits for HR, today's agenda, attendance per division, the assignments
 * due first and the latest notes of the HR team. Bounded queries: the number
 * of queries does not grow with people, requests or tasks.
 */
final class HrSummary
{
    public const int ACTION_LIMIT = 8;

    /** Requests waiting longer than this are "terlambat diputus". */
    public const int OVERDUE_HOURS = 24;

    public function __construct(
        private readonly HrDashboard $hr,
        private readonly ScheduleResolver $schedules,
        private readonly HrAssignments $assignments,
        private readonly HrCalendar $calendar,
        private readonly HiringAccess $hiring,
    ) {}

    /**
     * @param  array<string, Workspace>  $workspaces  EnsureHrWorkspaces::handle()
     * @return array<string, mixed>
     */
    public function for(User $viewer, CarbonImmutable $now, array $workspaces = []): array
    {
        $people = self::people($viewer);
        $ids = array_values(array_map('strval', $people->modelKeys()));
        $today = $this->hr->today($people, $now);
        $reports = $this->reports($people, $now);
        $pending = $this->hr->pendingHrQuery($ids);
        $assignments = $this->assignments->summary($viewer, $now, 3, $workspaces[SystemWorkspace::HrAssignments->value] ?? null);
        $agenda = $this->calendar->day($viewer, $now);
        $actions = $this->actions($viewer, $ids, $now);

        return [
            'kpis' => [
                'present' => $today['counts']['present'],
                'total_scheduled' => $today['counts']['scheduled'],
                'late' => $today['counts']['late'],
                'not_checked_in' => $today['counts']['not_checked_in'],
                'pending_requests' => (clone $pending)->count(),
                'pending_requests_overdue' => (clone $pending)->where('activated_at', '<', $now->subHours(self::OVERDUE_HOURS))->count(),
                'reports_submitted' => $reports['submitted'],
                'reports_scheduled' => $reports['scheduled'],
                'reports_draft' => $reports['draft'],
                'assignments_open' => $assignments['open'],
                'assignments_overdue' => $assignments['overdue'],
                'agenda_count' => count($agenda),
            ],
            'actions' => $actions,
            'agenda' => $agenda,
            'divisions' => array_values(array_map(fn (array $division): array => [
                'id' => $division['id'],
                'name' => $division['name'],
                'present' => $division['present'],
                'late' => $division['late'],
                'scheduled' => $division['scheduled'],
            ], $today['divisions'])),
            'assignments' => $assignments['top'],
            'notes' => $this->notes($viewer, $workspaces[SystemWorkspace::HrTeam->value] ?? null),
        ];
    }

    /**
     * Active employees HR may see (the whole company), with `division`.
     *
     * @return Collection<int, User>
     */
    public static function people(User $viewer): Collection
    {
        return User::query()
            ->visibleTo($viewer)
            ->active()
            ->with('division:id,name')
            ->orderBy('name')
            ->get();
    }

    /**
     * Daily reports today: sent / draft among everyone, scheduled from the shifts.
     *
     * @param  Collection<int, User>  $people
     * @return array{scheduled: int, submitted: int, draft: int}
     */
    private function reports(Collection $people, CarbonImmutable $now): array
    {
        $date = Period::officeDate($now);
        $day = $date->toDateString();
        $plans = $this->schedules->forRange($people, $date, $date);
        $scheduled = 0;

        foreach ($people as $user) {
            $scheduled += (($plans[$user->id][$day] ?? null)?->isWorkday() ?? false) ? 1 : 0;
        }

        $row = DailyReport::query()
            ->whereIn('user_id', $people->modelKeys())
            ->whereDate('report_date', $day)
            ->toBase()
            ->selectRaw('COUNT(*) FILTER (WHERE submitted_at IS NOT NULL) AS submitted')
            ->selectRaw('COUNT(*) FILTER (WHERE submitted_at IS NULL) AS draft')
            ->first();

        return ['scheduled' => $scheduled, 'submitted' => (int) ($row->submitted ?? 0), 'draft' => (int) ($row->draft ?? 0)];
    }

    /**
     * "Perlu tindakan": requests waiting for HR, password reset requests,
     * attendance days needing a correction (last 30 days) and new applicants,
     * oldest first.
     *
     * @param  list<string>  $ids
     * @return array{total: int, items: list<array{kind: string, title: string, subtitle: string|null, href: string, waiting_since: string|null}>}
     */
    private function actions(User $viewer, array $ids, CarbonImmutable $now): array
    {
        $items = [];
        $pending = $this->hr->pendingHrQuery($ids);
        $total = (clone $pending)->count();

        foreach ((clone $pending)->with(['request:id,user_id,leave_type_id,number', 'request.user:id,name', 'request.leaveType:id,name'])->oldest('activated_at')->limit(self::ACTION_LIMIT)->get() as $step) {
            /** @var RequestApproval $step */
            $request = $step->request;
            $items[] = [
                'kind' => 'request',
                'title' => $request->leaveType->name.' · '.$request->user->name,
                'subtitle' => $request->number,
                'href' => '/persetujuan/'.$request->id,
                'waiting_since' => $step->activated_at?->toIso8601String(),
            ];
        }

        $resets = PasswordResetRequest::query()->visibleTo($viewer)->awaitingDecision();
        $total += (clone $resets)->count();

        foreach ($resets->with('user:id,name')->oldest()->limit(self::ACTION_LIMIT)->get() as $reset) {
            $items[] = [
                'kind' => 'password_reset',
                'title' => 'Reset kata sandi · '.($reset->user->name ?? $reset->email),
                'subtitle' => 'Menunggu persetujuan HR',
                'href' => $reset->user_id !== null ? '/admin/karyawan/'.$reset->user_id : '/admin/karyawan',
                'waiting_since' => $reset->created_at?->toIso8601String(),
            ];
        }

        $since = Period::officeDate($now)->subDays(30)->toDateString();
        $corrections = AttendanceDay::query()
            ->whereIn('user_id', $ids)
            ->where('status', AttendanceStatus::NeedsCorrection->value)
            ->whereDate('work_date', '>=', $since);
        $total += (clone $corrections)->count();

        foreach ($corrections->with('user:id,name')->orderBy('work_date')->limit(self::ACTION_LIMIT)->get() as $day) {
            $date = $day->work_date->toDateString();
            $items[] = [
                'kind' => 'correction',
                'title' => 'Perlu koreksi absensi · '.$day->user->name,
                'subtitle' => $day->work_date->format('d/m/Y'),
                'href' => '/absensi/pegawai/'.$day->user_id.'/'.$date,
                'waiting_since' => CarbonImmutable::parse($date, CurrentCompany::timezone())->toIso8601String(),
            ];
        }

        if ($this->hiring->isManager($viewer)) {
            $applied = Candidate::query()->visibleTo($viewer)->where('stage', CandidateStage::Applied->value);
            $row = (clone $applied)->toBase()->selectRaw('COUNT(*) AS total, MIN(applied_at) AS oldest')->first();
            $count = (int) ($row->total ?? 0);

            if ($count > 0) {
                $total += $count;
                $items[] = [
                    'kind' => 'hiring',
                    'title' => "{$count} kandidat baru menunggu seleksi",
                    'subtitle' => 'Hiring',
                    'href' => '/hiring',
                    'waiting_since' => $row->oldest !== null ? CarbonImmutable::parse((string) $row->oldest)->toIso8601String() : null,
                ];
            }
        }

        usort($items, fn (array $a, array $b): int => ($a['waiting_since'] ?? '9') <=> ($b['waiting_since'] ?? '9'));

        return ['total' => $total, 'items' => array_slice($items, 0, self::ACTION_LIMIT)];
    }

    /**
     * Latest notes of the "Tim HR" workspace.
     *
     * @return list<array{id: string, title: string, updated_by: string|null, updated_at: string|null}>
     */
    private function notes(User $viewer, ?Workspace $team): array
    {
        if ($team === null || ! config('features.notes')) {
            return [];
        }

        return array_values(Note::query()
            ->visibleTo($viewer)
            ->where('notes.workspace_id', $team->id)
            ->where('notes.kind', 'note')
            ->with('editor:id,name')
            ->orderByDesc('notes.updated_at')
            ->limit(3)
            ->get(['notes.id', 'notes.title', 'notes.updated_by', 'notes.updated_at'])
            ->map(fn (Note $note): array => [
                'id' => $note->id,
                'title' => $note->title,
                'updated_by' => $note->editor?->name,
                'updated_at' => $note->updated_at?->toIso8601String(),
            ])
            ->all());
    }
}
