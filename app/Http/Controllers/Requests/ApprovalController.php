<?php

namespace App\Http\Controllers\Requests;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Requests\Actions\ApproveStep;
use App\Domain\Requests\Actions\BulkApprove;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\RequestRevision;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\Requests\Services\ColleagueAbsences;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Requests\BulkApproveRequest;
use App\Http\Requests\Requests\DecideRequestRequest;
use App\Models\ApprovalDelegation;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * "Persetujuan": queue of the signed-in approver, decisions, bulk approve.
 */
class ApprovalController extends Controller
{
    private const array RELATIONS = ['request.leaveType', 'request.user.position', 'request.user.division', 'request.approvals.approver'];

    public function __construct(
        private readonly ApprovalQueue $queue,
        private readonly RequestPresenter $presenter,
        private readonly ColleagueAbsences $colleagues,
    ) {}

    public function index(Request $http, #[CurrentUser] User $user): Response
    {
        Gate::authorize('viewAny', EmployeeRequest::class);

        $tab = $http->query('tab') === 'diputus' ? 'diputus' : 'menunggu';

        $items = $tab === 'menunggu'
            ? $this->waitingSteps($user)->map(fn (RequestApproval $step): array => $this->queueItem($step))
            : $this->queue->decidedBy($user)->with(self::RELATIONS)->limit(50)->get()->map(fn (RequestApproval $step): array => [
                ...$this->presenter->item($step->request),
                'my_decision' => [
                    'status' => $step->status->value,
                    'status_label' => $step->status->label(),
                    'note' => $step->note,
                    'decided_at' => $step->decided_at?->toIso8601String(),
                ],
            ]);

        $selectedId = $http->query('pilih');
        $selected = is_string($selectedId) ? EmployeeRequest::query()->find($selectedId) : null;
        $first = $items->first();
        $selected ??= is_array($first) && is_string($first['id'] ?? null) ? EmployeeRequest::query()->find($first['id']) : null;

        return Inertia::render('approvals/index', [
            'tab' => $tab,
            'counts' => [
                'menunggu' => $this->queue->count($user),
                'diputus' => $this->queue->decidedBy($user)->count(),
            ],
            'items' => $items->values()->all(),
            'selected' => $selected !== null && Gate::allows('view', $selected) ? $this->presenter->detail($selected, $user) : null,
            'scope' => $this->scopeDescription($user),
            'delegations' => $this->delegations($user),
        ]);
    }

    public function show(#[CurrentUser] User $user, EmployeeRequest $employeeRequest): Response
    {
        Gate::authorize('view', $employeeRequest);

        $ids = $this->queue->waitingFor($user)->orderBy('activated_at')->pluck('request_id')->values();
        $position = $ids->search($employeeRequest->id);

        return Inertia::render('approvals/show', [
            'request' => $this->presenter->detail($employeeRequest, $user),
            'queue' => [
                'position' => $position === false ? null : $position + 1,
                'total' => $ids->count(),
                'next_id' => $position === false ? $ids->first() : $ids->get($position + 1),
            ],
        ]);
    }

    public function approve(DecideRequestRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, ApproveStep $approve): RedirectResponse
    {
        Gate::authorize('decide', $employeeRequest);

        $request = $approve->handle($user, $employeeRequest, $form->note());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Pengajuan {$request->number} disetujui."]);

        return $this->afterDecision($form, $user);
    }

    public function reject(DecideRequestRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, RejectStep $reject): RedirectResponse
    {
        Gate::authorize('decide', $employeeRequest);

        $request = $reject->handle($user, $employeeRequest, (string) $form->note());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Pengajuan {$request->number} ditolak."]);

        return $this->afterDecision($form, $user);
    }

    public function revise(DecideRequestRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, RequestRevision $revision): RedirectResponse
    {
        Gate::authorize('decide', $employeeRequest);

        $request = $revision->handle($user, $employeeRequest, (string) $form->note());
        Inertia::flash('toast', ['type' => 'success', 'message' => "Revisi diminta untuk {$request->number}."]);

        return $this->afterDecision($form, $user);
    }

    public function bulk(BulkApproveRequest $form, #[CurrentUser] User $user, BulkApprove $bulk): RedirectResponse
    {
        Gate::authorize('viewAny', EmployeeRequest::class);

        $result = $bulk->handle($user, $form->ids());
        $approved = count($result['approved']);
        $failed = count($result['failed']);

        Inertia::flash('toast', $failed === 0
            ? ['type' => 'success', 'message' => "{$approved} pengajuan disetujui."]
            : ['type' => 'warning', 'message' => "{$approved} pengajuan disetujui, {$failed} gagal (sudah diputus atau bukan giliran Anda)."]);

        return to_route('approvals.index');
    }

    /**
     * Mobile detail goes on to the next waiting request; elsewhere back to the queue.
     */
    private function afterDecision(DecideRequestRequest $form, User $user): RedirectResponse
    {
        if ($form->input('redirect') === 'next') {
            $next = $this->queue->waitingFor($user)->orderBy('activated_at')->value('request_id');

            return is_string($next)
                ? to_route('approvals.show', ['employeeRequest' => $next])
                : to_route('approvals.index');
        }

        return to_route('approvals.index');
    }

    /**
     * @return Collection<int, RequestApproval>
     */
    private function waitingSteps(User $user): Collection
    {
        return $this->queue->waitingFor($user)->with(self::RELATIONS)->orderBy('activated_at')->limit(100)->get()->toBase();
    }

    /**
     * @return array<string, mixed>
     */
    private function queueItem(RequestApproval $step): array
    {
        $request = $step->request;
        $colleagues = $request->leaveType->category->isAbsence()
            ? $this->colleagues->around($request->user, $request->start_at, $request->end_at, $request->id)
            : null;

        return [
            ...$this->presenter->item($request),
            'colleagues' => $colleagues === null || $colleagues['people'] === [] ? null : $colleagues,
        ];
    }

    private function scopeDescription(User $user): string
    {
        if ($user->hasPermission(Permission::RequestsViewAll)) {
            return 'Pengajuan karyawan yang menunggu keputusan Anda.';
        }

        $division = $user->ledDivisions()->value('name');

        return is_string($division)
            ? "Pengajuan anggota Divisi {$division} yang menunggu keputusan Anda."
            : 'Pengajuan yang menunggu keputusan Anda.';
    }

    /**
     * @return array{items: list<array<string, mixed>>, colleagues: list<array{id: string, name: string, avatar: string|null}>, today: string}
     */
    private function delegations(User $user): array
    {
        $today = OfficeTime::todayString();

        $items = ApprovalDelegation::query()
            ->where('delegator_id', $user->id)
            ->whereDate('ends_on', '>=', $today)
            ->with('delegate')
            ->orderBy('starts_on')
            ->get()
            ->map(fn (ApprovalDelegation $delegation): array => [
                'id' => $delegation->id,
                'delegate' => RequestPresenter::person($delegation->delegate),
                'starts_on' => $delegation->starts_on->toDateString(),
                'ends_on' => $delegation->ends_on->toDateString(),
                'reason' => $delegation->reason,
                'active' => $delegation->starts_on->toDateString() <= $today,
            ])
            ->all();

        $colleagues = User::query()
            ->active()
            ->where('company_id', $user->company_id)
            ->whereKeyNot($user->id)
            ->orderBy('name')
            ->limit(300)
            ->get(['id', 'name', 'avatar_url'])
            ->map(fn (User $person): array => ['id' => $person->id, 'name' => $person->name, 'avatar' => $person->avatar_url])
            ->values()
            ->all();

        return ['items' => array_values($items), 'colleagues' => array_values($colleagues), 'today' => $today];
    }
}
