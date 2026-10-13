<?php

namespace App\Http\Controllers\Api\Requests;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Requests\Actions\ApproveStep;
use App\Domain\Requests\Actions\CancelApprovedRequest;
use App\Domain\Requests\Actions\RejectStep;
use App\Domain\Requests\Actions\RequestRevision;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Domain\Requests\Services\ApprovedCancellationPreview;
use App\Domain\Requests\Services\ColleagueAbsences;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Api\Requests\Concerns\AuthorizesRequests;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Api\Pengajuan\DecideApiRequest;
use App\Http\Requests\Requests\CancelApprovedRequestRequest;
use App\Http\Resources\Api\RequestDetail;
use App\Models\ApprovalDelegation;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * "Persetujuan" of the mobile app (B4-A): the approver's queue (Menunggu ·
 * Sudah diputus · Disetujui for HR/Super Admin), the badge count, the
 * detail with decision context, approve / reject / ask for revision and HR's
 * cancellation of an approved request. Thin over the web ApprovalQueue,
 * ApproveStep / RejectStep / RequestRevision / CancelApprovedRequest and
 * EmployeeRequestPolicy. A decision on a step someone already decided (or a
 * request no longer pending) answers 409 `code: sudah_diputus`. No bulk
 * approve: desktop only (docs/PLATFORM.md §3).
 */
class ApprovalController extends Controller
{
    use AuthorizesRequests;

    private const int PER_PAGE = 20;

    private const array RELATIONS = ['request.leaveType', 'request.user.position', 'request.user.division', 'request.user.team', 'request.approvals.approver', 'delegatedFrom'];

    public function __construct(
        private readonly ApprovalQueue $queue,
        private readonly RequestPresenter $presenter,
        private readonly RequestDetail $detail,
        private readonly ColleagueAbsences $colleagues,
    ) {}

    /**
     * GET /persetujuan/daftar?tab=menunggu|diputus|disetujui&page=
     */
    public function index(Request $http, #[CurrentUser] User $user): JsonResponse
    {
        $this->allow($user, 'viewAny', EmployeeRequest::class, 'Akun Anda tidak bisa membuka persetujuan.');

        $canCancelApproved = $user->hasPermission(Permission::RequestsCancelApproved);
        $tab = match ($http->query('tab')) {
            'diputus' => 'diputus',
            'disetujui' => $canCancelApproved ? 'disetujui' : 'menunggu',
            default => 'menunggu',
        };

        [$items, $page] = match ($tab) {
            'menunggu' => $this->waitingPage($user),
            'diputus' => $this->decidedPage($user),
            default => $this->approvedPage($user),
        };

        return response()->json([
            'tab' => $tab,
            'tabs' => $canCancelApproved ? ['menunggu', 'diputus', 'disetujui'] : ['menunggu', 'diputus'],
            'counts' => [
                'menunggu' => $this->queue->count($user),
                'diputus' => $this->queue->decidedBy($user)->count(),
                ...($canCancelApproved ? ['disetujui' => $this->approvedQuery($user)->count()] : []),
            ],
            'items' => $items,
            'meta' => self::meta($page),
            'can_cancel_approved' => $canCancelApproved,
            'delegation' => $this->delegationBanner($user),
        ]);
    }

    /**
     * GET /persetujuan/hitung — badge of Lainnya/Beranda: one count query.
     */
    public function count(#[CurrentUser] User $user): JsonResponse
    {
        return response()->json(['menunggu' => $user->isActive() ? $this->queue->count($user) : 0]);
    }

    /**
     * GET /persetujuan/{id} — detail with the decision context: position in
     * the queue, the step the caller would decide (and for whom), and the
     * caller's own decision once taken.
     */
    public function show(#[CurrentUser] User $user, EmployeeRequest $employeeRequest): JsonResponse
    {
        $this->visible($user, $employeeRequest);

        return response()->json([
            'request' => $this->detail->make($employeeRequest, $user),
            ...$this->context($user, $employeeRequest),
        ]);
    }

    public function approve(DecideApiRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, ApproveStep $approve): JsonResponse
    {
        return $this->decide($user, $employeeRequest, fn (): EmployeeRequest => $approve->handle($user, $employeeRequest, $form->note()));
    }

    public function reject(DecideApiRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, RejectStep $reject): JsonResponse
    {
        return $this->decide($user, $employeeRequest, fn (): EmployeeRequest => $reject->handle($user, $employeeRequest, (string) $form->note()));
    }

    public function revise(DecideApiRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, RequestRevision $revision): JsonResponse
    {
        return $this->decide($user, $employeeRequest, fn (): EmployeeRequest => $revision->handle($user, $employeeRequest, (string) $form->note()));
    }

    /**
     * POST /pengajuan/{id}/batal-disetujui {reason ≥ 10} — HR / Super Admin
     * void an approved request. A blocked revert (the corrected day changed
     * since) answers 422 `code: tidak_bisa_dibatalkan` before anything runs.
     */
    public function cancelApproved(CancelApprovedRequestRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, CancelApprovedRequest $cancel, ApprovedCancellationPreview $preview): JsonResponse
    {
        $this->visible($user, $employeeRequest);

        if (! CancelApprovedRequest::allowedFor($user, $employeeRequest)) {
            throw new AuthorizationException('Hanya HR atau Super Admin yang bisa membatalkan pengajuan yang sudah disetujui.');
        }

        $effects = null;

        if ($employeeRequest->status === RequestStatus::Approved) {
            $effects = $preview->for($employeeRequest);

            if ($effects['blocker'] !== null) {
                return response()->json([
                    'message' => $effects['blocker'],
                    'code' => 'tidak_bisa_dibatalkan',
                    'errors' => ['reason' => [$effects['blocker']]],
                ], 422);
            }
        }

        $request = $cancel->handle($user, $employeeRequest, $form->reason());
        $today = OfficeTime::todayString();
        $attendance = $effects['attendance'] ?? [];

        return response()->json([
            'request' => $this->detail->make($request->fresh() ?? $request, $user),
            'effects' => [
                'refund_days' => $effects['refund_days'] ?? null,
                'balance_year' => $effects['balance_year'] ?? null,
                'removed_dates' => $attendance['removed_dates'] ?? [],
                'unlinked_dates' => $attendance['unlinked_dates'] ?? [],
                // Past dates closed again right away (no check-in = Alpha).
                'reclosed_dates' => array_values(array_filter(
                    [...($attendance['removed_dates'] ?? []), $attendance['correction_date'] ?? null],
                    fn (mixed $date): bool => is_string($date) && $date < $today,
                )),
                'overtime_date' => $attendance['overtime_date'] ?? null,
                'correction_date' => $attendance['correction_date'] ?? null,
            ],
        ]);
    }

    /**
     * @param  Closure(): EmployeeRequest  $action
     */
    private function decide(User $user, EmployeeRequest $request, Closure $action): JsonResponse
    {
        $this->visible($user, $request);

        if (Gate::forUser($user)->denies('decide', $request)) {
            return $this->notDecidable($user, $request);
        }

        try {
            $decided = $action();
        } catch (AuthorizationException) {
            // Someone else decided between our check and the row lock.
            return $this->notDecidable($user, $request->fresh() ?? $request);
        }

        $decided = $decided->fresh() ?? $decided;
        $next = $this->queue->waitingFor($user)->orderBy('activated_at')->orderBy('id')->value('request_id');

        return response()->json([
            'request' => $this->detail->make($decided, $user),
            'next_id' => is_string($next) ? $next : null,
            'menunggu' => $this->queue->count($user),
        ]);
    }

    /**
     * 409 when the caller's turn is over (the request is no longer pending, or
     * the step meant for them — or their role — was decided already), else 403.
     */
    private function notDecidable(User $user, EmployeeRequest $request): JsonResponse
    {
        $request->load(['approvals.approver']);
        $status = ['id' => $request->id, 'status' => $request->status->value, 'status_label' => $request->status->label()];

        if ($request->status !== RequestStatus::Pending) {
            return response()->json([
                'message' => 'Pengajuan ini sudah '.mb_strtolower($request->status->label()).'. Tidak ada keputusan yang perlu diambil.',
                'code' => 'sudah_diputus',
                'request' => $status,
            ], 409);
        }

        $decided = $request->currentSteps()->first(fn (RequestApproval $step): bool => $step->status->isDecision()
            && ($step->approver_id === $user->id
                || $step->delegated_from_id === $user->id
                || ($step->approver_type === ApproverType::Role && $step->approver_role !== null && $user->hasRole($step->approver_role))));

        if ($decided !== null) {
            $by = $decided->approver_id === $user->id ? 'Anda' : ($decided->approver->name ?? 'penyetuju lain');

            return response()->json([
                'message' => "Langkah ini sudah diputus oleh {$by}.",
                'code' => 'sudah_diputus',
                'request' => $status,
            ], 409);
        }

        throw new AuthorizationException('Anda tidak bisa memutus pengajuan ini.');
    }

    /**
     * @return array<string, mixed>
     */
    private function context(User $user, EmployeeRequest $request): array
    {
        $ids = $this->queue->waitingFor($user)->orderBy('activated_at')->orderBy('id')->pluck('request_id')->values();
        $position = $ids->search($request->id);
        $request->loadMissing(['approvals.approver', 'approvals.delegatedFrom']);
        $waiting = $request->waitingStep();
        $decide = Gate::forUser($user)->allows('decide', $request);

        $mine = $request->approvals
            ->filter(fn (RequestApproval $step): bool => $step->status->isDecision() && $step->approver_id === $user->id)
            ->sortByDesc(fn (RequestApproval $step): string => (string) $step->decided_at?->toIso8601String())
            ->first();

        return [
            'queue' => [
                'position' => $position === false ? null : $position + 1,
                'total' => $ids->count(),
                'next_id' => $position === false ? $ids->first() : $ids->get($position + 1),
            ],
            'my_step' => ! $decide || $waiting === null ? null : [
                'id' => $waiting->id,
                'label' => $waiting->stepLabel(),
                'step_order' => $waiting->step_order,
                'on_behalf_of' => $waiting->delegatedFrom === null ? null : RequestPresenter::person($waiting->delegatedFrom),
                'since' => $waiting->activated_at?->toIso8601String(),
            ],
            'my_decision' => $mine === null ? null : [
                'status' => $mine->status->value,
                'status_label' => $mine->status->label(),
                'note' => $mine->note,
                'decided_at' => $mine->decided_at?->toIso8601String(),
            ],
        ];
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: LengthAwarePaginator<int, RequestApproval>}
     */
    private function waitingPage(User $user): array
    {
        /** @var LengthAwarePaginator<int, RequestApproval> $page */
        $page = $this->queue->waitingFor($user)->with(self::RELATIONS)->orderBy('activated_at')->orderBy('id')->paginate(self::PER_PAGE);
        $steps = collect($page->items());

        $absences = $steps->map(fn (RequestApproval $step): EmployeeRequest => $step->request)
            ->filter(fn (EmployeeRequest $request): bool => $request->leaveType->category->isAbsence());
        $colleagues = $this->colleagues->forRequests($absences);

        $items = $steps->map(function (RequestApproval $step) use ($colleagues): array {
            $found = $colleagues[$step->request->id] ?? null;

            return [
                ...$this->presenter->item($step->request),
                'colleagues' => $found === null || $found['people'] === [] ? null : $found,
                'step' => [
                    'id' => $step->id,
                    'label' => $step->stepLabel(),
                    'on_behalf_of' => $step->delegatedFrom === null ? null : RequestPresenter::person($step->delegatedFrom),
                    'since' => $step->activated_at?->toIso8601String(),
                ],
            ];
        });

        return [array_values($items->all()), $page];
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: LengthAwarePaginator<int, RequestApproval>}
     */
    private function decidedPage(User $user): array
    {
        /** @var LengthAwarePaginator<int, RequestApproval> $page */
        $page = $this->queue->decidedBy($user)->with(self::RELATIONS)->orderByDesc('id')->paginate(self::PER_PAGE);

        $items = collect($page->items())->map(fn (RequestApproval $step): array => [
            ...$this->presenter->item($step->request),
            'my_decision' => [
                'status' => $step->status->value,
                'status_label' => $step->status->label(),
                'note' => $step->note,
                'decided_at' => $step->decided_at?->toIso8601String(),
                'on_behalf_of' => $step->delegatedFrom === null ? null : RequestPresenter::person($step->delegatedFrom),
            ],
        ]);

        return [array_values($items->all()), $page];
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: LengthAwarePaginator<int, EmployeeRequest>}
     */
    private function approvedPage(User $user): array
    {
        /** @var LengthAwarePaginator<int, EmployeeRequest> $page */
        $page = $this->approvedQuery($user)
            ->with(['leaveType', 'user.position', 'user.division', 'approvals.approver'])
            ->orderByDesc('decided_at')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE);

        $items = collect($page->items())->map(fn (EmployeeRequest $request): array => $this->presenter->item($request));

        return [array_values($items->all()), $page];
    }

    /**
     * Approved requests of other people in the viewer's scope (tab
     * "Disetujui", HR / Super Admin) — same query as the web.
     *
     * @return Builder<EmployeeRequest>
     */
    private function approvedQuery(User $user): Builder
    {
        return EmployeeRequest::query()
            ->visibleTo($user)
            ->where('requests.status', RequestStatus::Approved->value)
            ->where('requests.user_id', '!=', $user->id);
    }

    /**
     * Banners above the queue: my active delegation ("Delegasi aktif … sampai")
     * and the people I currently stand in for ("Anda mewakili …").
     *
     * @return array{active: array<string, mixed>|null, representing: list<array<string, mixed>>}
     */
    private function delegationBanner(User $user): array
    {
        $today = OfficeTime::todayString();

        $active = ApprovalDelegation::query()->where('delegator_id', $user->id)->activeOn($today)->with('delegate')->orderBy('starts_on')->first();

        /** @var Collection<int, ApprovalDelegation> $received */
        $received = ApprovalDelegation::query()->where('delegate_id', $user->id)->activeOn($today)->with('delegator')->orderBy('starts_on')->get();

        return [
            'active' => $active === null ? null : [
                'id' => $active->id,
                'delegate' => RequestPresenter::person($active->delegate),
                'starts_on' => $active->starts_on->toDateString(),
                'ends_on' => $active->ends_on->toDateString(),
            ],
            'representing' => array_values($received->map(fn (ApprovalDelegation $delegation): array => [
                'id' => $delegation->id,
                'delegator' => RequestPresenter::person($delegation->delegator),
                'ends_on' => $delegation->ends_on->toDateString(),
            ])->all()),
        ];
    }

    /**
     * @param  LengthAwarePaginator<int, mixed>  $page
     * @return array<string, int|null>
     */
    private static function meta(LengthAwarePaginator $page): array
    {
        return [
            'current_page' => $page->currentPage(),
            'from' => $page->firstItem(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'to' => $page->lastItem(),
            'total' => $page->total(),
        ];
    }
}
