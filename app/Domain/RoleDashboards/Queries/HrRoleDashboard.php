<?php

namespace App\Domain\RoleDashboards\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\RoleDashboards\Support\Blocks;
use App\Http\Presenters\RequestPresenter;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * HR job dashboard: the requests waiting for the viewer's decision
 * (ApprovalQueue — the leave review flow), requests waiting at an HR step
 * (HrDashboard::pendingHr, read only), approved leave in the next 14 days and
 * the viewer's decisions this month. Attendance (present, not checked in,
 * missed check-outs, discipline) lives in the Absensi module (owner decision
 * 6 Okt) and is only linked (/absensi/hari-ini). Live except the
 * upcoming-leave block (cached 5 minutes, view "peran").
 */
final class HrRoleDashboard
{
    public const int QUEUE_ROWS = 6;

    public const int UPCOMING_DAYS = 14;

    public const int UPCOMING_ROWS = 5;

    public const int TYPE_BARS = 6;

    private const array DETAIL_RELATIONS = ['request.leaveType', 'request.user.position', 'request.user.division', 'request.approvals.approver'];

    public function __construct(
        private readonly HrDashboard $hr,
        private readonly ApprovalQueue $queue,
        private readonly RequestPresenter $requests,
        private readonly MetricCache $cache,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(User $viewer, CarbonImmutable $now): array
    {
        /** @var list<string> $ids */
        $ids = User::query()->visibleTo($viewer)->active()->pluck('id')->all();
        $queueCount = $this->queue->count($viewer);
        $steps = $this->waiting($viewer)->with(['request.leaveType', 'request.user'])->limit(self::QUEUE_ROWS)->get();
        $pendingHr = $this->hr->pendingHr($ids);
        $decided = $this->queue->decidedBy($viewer)->where('decided_at', '>=', Period::officeDate($now)->startOfMonth()->utc()->toIso8601String())->count();
        $upcoming = $this->cache->remember('peran', $viewer, 'hr:upcoming', ['today' => Period::officeDate($now)->toDateString(), 'people' => sha1(implode(',', $ids))], fn (): array => $this->upcomingLeave($ids, $now));

        return [
            'unit' => 'SDM',
            'subtitle' => Blocks::join(
                Blocks::count($queueCount, 'pengajuan menunggu Anda'),
                Blocks::count($upcoming['count'], 'cuti disetujui 14 hari ke depan'),
            ) ?: 'Persetujuan dan cuti karyawan',
            'primary' => $queueCount > 0
                ? Blocks::flow($queueCount === 1 ? 'Tinjau 1 pengajuan' : "Tinjau {$queueCount} pengajuan")
                : Blocks::link('Buka persetujuan', '/persetujuan'),
            'secondary' => Blocks::link('Kehadiran hari ini', '/absensi/hari-ini'),
            'kpis' => [
                Blocks::kpi('Menunggu keputusan Anda', $queueCount, $queueCount > 0 ? 'cuti & izin lebih dulu' : 'Semua sudah diputus', 'highlight'),
                Blocks::kpi('Menunggu langkah HR', $pendingHr['count'], $pendingHr['count'] > 0 ? 'di seluruh HR' : 'Tidak ada yang tertahan', $pendingHr['count'] > 0 ? 'warm' : 'plain'),
                Blocks::kpi('Cuti disetujui', $upcoming['count'], '14 hari ke depan'),
                Blocks::kpi('Diputus Anda', $decided, 'bulan ini'),
            ],
            'list' => [
                'title' => 'Menunggu keputusan Anda',
                'link' => Blocks::link('Persetujuan', '/persetujuan'),
                'empty' => 'Tidak ada pengajuan yang menunggu keputusan Anda.',
                'rows' => array_values($steps->map(fn (RequestApproval $step): array => BoardRoleDashboard::requestRow($step))->all()),
            ],
            'bars' => [
                'title' => 'Antrean per jenis',
                'note' => 'pengajuan yang menunggu Anda',
                'empty' => 'Antrean Anda kosong.',
                'items' => $this->queueByType($viewer),
            ],
            'schedule' => [
                'title' => 'Cuti mendatang',
                'link' => Blocks::link('Kehadiran hari ini', '/absensi/hari-ini'),
                'empty' => 'Tidak ada cuti yang disetujui dalam 14 hari.',
                'items' => $upcoming['items'],
            ],
            'side' => [
                'title' => 'Menunggu langkah HR',
                'warm' => false,
                'empty' => 'Tidak ada pengajuan yang tertahan di langkah HR.',
                'items' => array_values(array_map(fn (array $item): array => [
                    'title' => $item['type']['name'].' · '.$item['user']['name'],
                    'meta' => Blocks::join((string) $item['number'], $item['waiting'] !== null && $item['waiting']['approver'] !== null ? 'menunggu '.$item['waiting']['approver']['name'] : 'menunggu HR'),
                    'href' => '/persetujuan/'.$item['id'],
                ], $pendingHr['items'])),
            ],
        ];
    }

    /**
     * Leave review flow: one request in full (RequestPresenter::detail) —
     * the chosen one (`?pilih=`) when it still waits for the viewer, else the
     * first of the queue (absences first, oldest first).
     *
     * @return array{total: int, selected: array<string, mixed>|null, items: list<array<string, mixed>>}
     */
    public function reviewFlow(User $viewer, ?string $selectedId): array
    {
        $steps = $this->waiting($viewer)->with(self::DETAIL_RELATIONS)->limit(self::QUEUE_ROWS)->get();
        $selected = null;

        // Only a request still waiting for the viewer can be picked: after a
        // decision the page comes back with the next one, not the decided one.
        if ($selectedId !== null) {
            $step = $steps->firstWhere('request_id', $selectedId)
                ?? $this->waiting($viewer)->where('request_approvals.request_id', $selectedId)->with(self::DETAIL_RELATIONS)->first();
            $selected = $step?->request;
        }

        $selected ??= $steps->first()?->request;

        return [
            'total' => $this->queue->count($viewer),
            'selected' => $selected === null ? null : $this->requests->detail($selected, $viewer),
            'items' => array_values($steps->map(fn (RequestApproval $step): array => $this->requests->item($step->request))->all()),
        ];
    }

    /**
     * The viewer's waiting steps: absences (cuti, izin, sakit, dinas) first, oldest first.
     *
     * @return Builder<RequestApproval>
     */
    private function waiting(User $viewer): Builder
    {
        $absence = self::absenceCategories();

        return $this->queue->waitingFor($viewer)
            ->orderByRaw('case when exists (select 1 from requests r join leave_types lt on lt.id = r.leave_type_id where r.id = request_approvals.request_id and lt.category in ('.implode(',', array_fill(0, count($absence), '?')).')) then 0 else 1 end', $absence)
            ->orderBy('activated_at');
    }

    /**
     * @return list<string>
     */
    private static function absenceCategories(): array
    {
        return array_values(array_map(
            fn (RequestCategory $category): string => $category->value,
            array_filter(RequestCategory::cases(), fn (RequestCategory $category): bool => $category->isAbsence()),
        ));
    }

    /**
     * Approved whole-day absences starting in the next 14 days.
     *
     * @param  list<string>  $userIds
     * @return array{count: int, items: list<array<string, mixed>>}
     */
    private function upcomingLeave(array $userIds, CarbonImmutable $now): array
    {
        $absence = self::absenceCategories();
        $start = Period::officeDate($now);
        $query = EmployeeRequest::query()
            ->whereIn('user_id', $userIds)
            ->where('status', RequestStatus::Approved->value)
            ->where('start_at', '>=', $start->utc()->toIso8601String())
            ->where('start_at', '<', $start->addDays(self::UPCOMING_DAYS)->utc()->toIso8601String())
            ->whereHas('leaveType', fn (Builder $type) => $type->whereIn('category', $absence));

        return ['count' => (clone $query)->count(), 'items' => array_values($query
            ->with(['user:id,name', 'leaveType:id,name,category'])
            ->orderBy('start_at')
            ->limit(self::UPCOMING_ROWS)
            ->get()
            ->map(fn (EmployeeRequest $request): array => Blocks::event(
                $request->id,
                Period::officeDate($request->start_at)->toDateString(),
                $request->user->name,
                'leave',
                Blocks::join($request->leaveType->name, $request->days !== null ? rtrim(rtrim(number_format((float) $request->days, 1, ',', '.'), '0'), ',').' hari' : ''),
            ))
            ->all())];
    }

    /**
     * The viewer's waiting steps grouped by request type (bar = share of the largest group).
     *
     * @return list<array<string, mixed>>
     */
    private function queueByType(User $viewer): array
    {
        // ApprovalQueue's columns are unqualified: filter by id, then join.
        $rows = DB::table('request_approvals')
            ->whereIn('request_approvals.id', $this->queue->waitingFor($viewer)->select('id'))
            ->join('requests', 'requests.id', '=', 'request_approvals.request_id')
            ->join('leave_types', 'leave_types.id', '=', 'requests.leave_type_id')
            ->selectRaw('leave_types.id, leave_types.name, leave_types.category, count(*) as total')
            ->groupBy('leave_types.id', 'leave_types.name', 'leave_types.category')
            ->orderByDesc('total')
            ->orderBy('leave_types.name')
            ->limit(self::TYPE_BARS)
            ->get();
        $max = max(1, (int) $rows->max('total'));

        return array_values($rows->map(fn (object $row): array => Blocks::bar(
            (string) $row->id,
            (string) $row->name,
            RequestCategory::from((string) $row->category)->label(),
            (int) $row->total / $max * 100,
            null,
            ((int) $row->total).' menunggu',
            'ok',
        ))->all());
    }
}
