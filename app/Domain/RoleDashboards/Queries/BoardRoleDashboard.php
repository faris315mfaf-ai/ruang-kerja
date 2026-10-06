<?php

namespace App\Domain\RoleDashboards\Queries;

use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Projects\Data\PortfolioFilters;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Queries\PortfolioDashboard;
use App\Domain\Projects\Queries\ProjectMetrics;
use App\Domain\Projects\Services\ProjectClock;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Domain\RoleDashboards\Support\Blocks;
use App\Http\Presenters\RequestPresenter;
use App\Models\ProjectUpdate;
use App\Models\RequestApproval;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Direktur Utama and Direktur dashboards: the project portfolio
 * (PortfolioDashboard, cached 5 minutes under the "peran" view) plus live
 * work — open project decisions (Dirut) or the approval queue (Direktur).
 */
final class BoardRoleDashboard
{
    /** Rows of "Butuh keputusan Anda" / decisions in the decision flow. */
    public const int DECISION_LIMIT = 10;

    /** Rows of "Menunggu persetujuan Anda" on the dashboard. */
    public const int QUEUE_ROWS = 6;

    /** Items in the approvals flow. */
    public const int QUEUE_FLOW_LIMIT = 20;

    /** Bars of "Portofolio proyek". */
    public const int PROJECT_BARS = 8;

    private const array QUEUE_RELATIONS = ['request.leaveType', 'request.user.position', 'request.user.division', 'request.approvals.approver'];

    public function __construct(
        private readonly PortfolioDashboard $portfolio,
        private readonly ProjectMetrics $metrics,
        private readonly ApprovalQueue $queue,
        private readonly RequestPresenter $requests,
        private readonly MetricCache $cache,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(User $viewer, DashboardRole $role, CarbonImmutable $now): array
    {
        $today = ProjectClock::today();
        $board = $this->cache->remember('peran', $viewer, 'board', ['today' => $today->toDateString()], fn (): array => $this->board($viewer, $today));

        return $role === DashboardRole::Dirut
            ? $this->dirut($viewer, $board)
            : $this->direktur($viewer, $board);
    }

    /**
     * Decision flow (Dirut): open decisions with the project's progress.
     *
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    public function decisionFlow(User $viewer): array
    {
        $today = ProjectClock::today();
        [$total, $updates] = $this->openDecisions($viewer);
        $metrics = $this->metrics->forWorkspaces($updates->map(fn (ProjectUpdate $update): Workspace => $update->workspace)->unique('id')->values(), $today);
        // Same rule as the portfolio (PortfolioDashboard::decisions); the endpoint re-checks the policy.
        $canSteer = $viewer->hasPermission(Permission::PortfolioView);

        return [
            'total' => $total,
            'items' => array_values($updates->map(fn (ProjectUpdate $update): array => [
                'id' => $update->id,
                'project' => [
                    'key' => $update->workspace->key,
                    'name' => $update->workspace->name,
                    'url' => '/w/'.$update->workspace->key.'/ringkasan',
                    'health' => $update->workspace->health?->value,
                    'health_label' => $update->workspace->health?->label(),
                    'actual' => $metrics[$update->workspace_id]->actual ?? null,
                    'planned' => $metrics[$update->workspace_id]->planned ?? null,
                    'target_date' => $update->workspace->target_date?->toDateString(),
                ],
                'decision' => (string) $update->decision_needed,
                'summary' => $update->summary,
                'blockers' => $update->blockers,
                'author' => $update->author === null ? null : ['id' => $update->author->id, 'name' => $update->author->name, 'avatar' => $update->author->avatar_url],
                'created_at' => $update->created_at->toIso8601String(),
                'can_resolve' => $canSteer,
            ])->all()),
        ];
    }

    /**
     * Approvals flow (Direktur): the viewer's waiting steps, oldest first.
     *
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    public function approvalFlow(User $viewer): array
    {
        $steps = $this->queue->waitingFor($viewer)->with(self::QUEUE_RELATIONS)->orderBy('activated_at')->limit(self::QUEUE_FLOW_LIMIT)->get();

        return [
            'total' => $this->queue->count($viewer),
            'items' => array_values($steps->map(fn (RequestApproval $step): array => $this->requests->item($step->request))->all()),
        ];
    }

    /**
     * @param  array<string, mixed>  $board
     * @return array<string, mixed>
     */
    private function dirut(User $viewer, array $board): array
    {
        [$total, $updates] = $this->openDecisions($viewer);

        return [
            'unit' => 'Direksi',
            'subtitle' => $board['subtitle'],
            'primary' => $total > 0 ? Blocks::flow($total === 1 ? 'Putuskan 1 keputusan' : "Putuskan {$total} keputusan") : Blocks::link('Buka portofolio', '/portofolio'),
            'secondary' => self::monitoring(),
            'kpis' => [
                $board['kpis']['projects'],
                Blocks::kpi('Butuh keputusan Anda', $total, $total > 0 ? 'dari PIC proyek' : 'Tidak ada yang menunggu', $total > 0 ? 'warm' : 'plain'),
                $board['kpis']['milestones'],
                $board['kpis']['attention'],
            ],
            'list' => [
                'title' => 'Butuh keputusan Anda',
                'link' => Blocks::link('Portofolio', '/portofolio'),
                'empty' => 'Tidak ada keputusan yang menunggu. Permintaan keputusan dari update PIC muncul di sini.',
                'rows' => array_values($updates->map(fn (ProjectUpdate $update): array => Blocks::row(
                    $update->id,
                    $update->workspace->key,
                    (string) $update->decision_needed,
                    Blocks::join($update->workspace->name, $update->author !== null ? 'Diajukan '.$update->author->name : ''),
                    'Keputusan',
                    Blocks::healthTone($update->workspace->health?->value) === 'ok' ? 'info' : Blocks::healthTone($update->workspace->health?->value),
                    flow: true,
                    at: ['value' => $update->created_at->toIso8601String(), 'style' => 'relative'],
                ))->all()),
            ],
            'bars' => $board['bars'],
            'schedule' => $board['schedule'],
            'side' => $board['attention'],
        ];
    }

    /**
     * @param  array<string, mixed>  $board
     * @return array<string, mixed>
     */
    private function direktur(User $viewer, array $board): array
    {
        $count = $this->queue->count($viewer);
        $steps = $this->queue->waitingFor($viewer)->with(['request.leaveType', 'request.user'])->orderBy('activated_at')->limit(self::QUEUE_ROWS)->get();
        [$decisions, $updates] = $this->openDecisions($viewer);

        return [
            'unit' => 'Direksi',
            'subtitle' => $board['subtitle'],
            'primary' => $count > 0 ? Blocks::flow($count === 1 ? 'Putuskan 1 pengajuan' : "Putuskan {$count} pengajuan") : Blocks::link('Buka persetujuan', '/persetujuan'),
            'secondary' => self::monitoring(),
            'kpis' => [
                Blocks::kpi('Menunggu persetujuan Anda', $count, $count > 0 ? 'pengajuan karyawan' : 'Semua sudah diputus', 'highlight'),
                $board['kpis']['projects_plain'],
                Blocks::kpi('Butuh keputusan Direksi', $decisions, $decisions > 0 ? 'dari PIC proyek' : 'Tidak ada yang menunggu'),
                $board['kpis']['milestones'],
            ],
            'list' => [
                'title' => 'Menunggu persetujuan Anda',
                'link' => Blocks::link('Persetujuan', '/persetujuan'),
                'empty' => 'Tidak ada pengajuan yang menunggu keputusan Anda.',
                'rows' => array_values($steps->map(fn (RequestApproval $step): array => self::requestRow($step))->all()),
            ],
            'bars' => $board['bars'],
            'schedule' => $board['schedule'],
            'side' => [
                'title' => 'Butuh keputusan Direksi',
                'warm' => $decisions > 0,
                'empty' => 'Tidak ada keputusan proyek yang menunggu.',
                'items' => array_values($updates->take(4)->map(fn (ProjectUpdate $update): array => [
                    'title' => $update->workspace->key.' · '.$update->decision_needed,
                    'meta' => Blocks::join($update->workspace->name, $update->author !== null ? 'Diajukan '.$update->author->name : ''),
                    'href' => '/w/'.$update->workspace->key.'/ringkasan',
                ])->all()),
            ],
        ];
    }

    /**
     * "Monitoring kerja": daily/weekly work monitoring lives on /dashboard
     * (owner decision 6 Okt), never duplicated on the job dashboards.
     *
     * @return array{label: string, href: string|null, flow: bool}
     */
    private static function monitoring(): array
    {
        return Blocks::link('Monitoring kerja', '/dashboard');
    }

    /**
     * Dashboard row of a waiting approval step (Direktur & HR).
     *
     * @return array<string, mixed>
     */
    public static function requestRow(RequestApproval $step): array
    {
        $request = $step->request;
        $category = $request->leaveType->category;
        $amount = $request->minutes !== null && $request->days === null
            ? round($request->minutes / 60, 1).' jam'
            : ($request->days !== null ? rtrim(rtrim(number_format((float) $request->days, 1, ',', '.'), '0'), ',').' hari' : '');

        return Blocks::row(
            $request->id,
            $request->leaveType->code,
            $request->leaveType->name.' · '.$request->user->name,
            Blocks::join((string) $request->number, $amount),
            $category->label(),
            match ($category) {
                RequestCategory::Overtime => 'warn',
                RequestCategory::Sick => 'late',
                RequestCategory::Correction => 'neutral',
                default => 'info',
            },
            flow: true,
            at: ['value' => $request->start_at->toIso8601String(), 'style' => 'date'],
        );
    }

    /**
     * Open decisions on open projects of the viewer's portfolio, oldest first.
     *
     * @return array{0: int, 1: Collection<int, ProjectUpdate>}
     */
    private function openDecisions(User $viewer): array
    {
        $query = ProjectUpdate::query()
            ->openDecision()
            ->whereIn('workspace_id', Workspace::query()
                ->portfolioFor($viewer)
                ->whereNull('archived_at')
                ->where(fn (Builder $status) => $status->whereNull('project_status')->orWhereIn('project_status', ProjectStatus::openValues()))
                ->select('workspaces.id'));

        return [
            (clone $query)->count(),
            $query->with(['author:id,name,avatar_url', 'workspace'])->oldest('created_at')->limit(self::DECISION_LIMIT)->get(),
        ];
    }

    /**
     * Cached portfolio blocks shared by Dirut and Direktur.
     *
     * @return array<string, mixed>
     */
    private function board(User $viewer, CarbonImmutable $today): array
    {
        $portfolio = $this->portfolio->build($viewer, new PortfolioFilters, $today);
        $health = $portfolio['kpis']['active']['health'];
        $active = (int) $portfolio['kpis']['active']['count'];
        $healthNote = Blocks::join(
            Blocks::count($health['on_track'], 'sesuai jalur'),
            Blocks::count($health['at_risk'], 'berisiko'),
            Blocks::count($health['off_track'], 'bermasalah'),
            Blocks::count($health['none'], 'belum ada update'),
        );
        $upcoming = $portfolio['kpis']['upcoming_milestones'];
        $missed = $portfolio['kpis']['missed_milestones'];
        $attention = count($portfolio['attention']);

        return [
            'subtitle' => Blocks::join($active.' proyek aktif', $portfolio['period_label']),
            'kpis' => [
                'projects' => Blocks::kpi('Proyek aktif', $active, $healthNote !== '' ? $healthNote : 'Belum ada proyek', 'highlight'),
                'projects_plain' => Blocks::kpi('Proyek aktif', $active, $healthNote !== '' ? $healthNote : 'Belum ada proyek'),
                'milestones' => Blocks::kpi('Milestone 14 hari', (int) $upcoming['count'], $missed['count'] > 0 ? $missed['count'].' terlewat' : 'Tidak ada yang terlewat'),
                'attention' => Blocks::kpi('Perlu perhatian', $attention, $attention > 0 ? 'bermasalah atau update kedaluwarsa' : 'Semua proyek terpantau'),
            ],
            'bars' => [
                'title' => 'Portofolio proyek',
                'note' => 'progres vs rencana (garis)',
                'empty' => 'Belum ada proyek aktif.',
                'items' => array_values(array_map(fn (array $project): array => Blocks::bar(
                    $project['id'],
                    $project['name'],
                    Blocks::join($project['key'], $project['next_milestone'] !== null ? 'berikutnya: '.$project['next_milestone']['name'] : 'tanpa milestone berikutnya'),
                    (float) ($project['metrics']['actual'] ?? 0),
                    $project['metrics']['planned'] === null ? null : (float) $project['metrics']['planned'],
                    $project['health'] !== null ? ProjectHealth::from($project['health'])->label() : 'Belum ada update',
                    Blocks::healthTone($project['health']),
                    '/w/'.$project['key'].'/ringkasan',
                ), array_slice($portfolio['projects'], 0, self::PROJECT_BARS))),
            ],
            'schedule' => [
                'title' => 'Milestone terdekat',
                'link' => Blocks::link('Portofolio', '/portofolio'),
                'empty' => 'Tidak ada milestone dalam 14 hari.',
                'items' => array_map(fn (array $milestone, int|string $index): array => Blocks::event(
                    'ms-'.$index,
                    $milestone['target_date'],
                    $milestone['name'],
                    'milestone',
                    $milestone['key'],
                    '/w/'.$milestone['key'].'/ringkasan',
                ), $upcoming['items'], array_keys($upcoming['items'])),
            ],
            'attention' => [
                'title' => 'Perlu perhatian',
                'warm' => false,
                'empty' => 'Semua proyek sesuai jalur dan update terbaru.',
                'items' => array_values(array_map(fn (array $item): array => [
                    'title' => $item['project']['key'].' · '.$item['project']['name'],
                    'meta' => Blocks::join(
                        $item['health'] === ProjectHealth::OffTrack->value ? 'Bermasalah' : '',
                        $item['metrics']['update_age_days'] !== null ? 'update terakhir '.$item['metrics']['update_age_days'].' hari lalu' : 'belum ada update',
                        $item['lead'] !== null ? 'PIC '.$item['lead']['name'] : '',
                    ),
                    'href' => '/w/'.$item['project']['key'].'/ringkasan',
                ], array_slice($portfolio['attention'], 0, 4))),
            ],
        ];
    }
}
