<?php

namespace App\Http\Controllers\Requests;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Actions\CancelRequest;
use App\Domain\Requests\Actions\SaveRequestDraft;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\RequestAttachmentStore;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Requests\SaveEmployeeRequestRequest;
use App\Models\Attachment;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * "Pengajuan saya": list, form (create / edit draft or revision), detail, cancel, attachments.
 */
class RequestController extends Controller
{
    /**
     * Status filter slugs → statuses.
     *
     * @var array<string, list<RequestStatus>>
     */
    private const array FILTERS = [
        'menunggu' => [RequestStatus::Pending, RequestStatus::RevisionRequested],
        'disetujui' => [RequestStatus::Approved],
        'ditolak' => [RequestStatus::Rejected],
    ];

    public function __construct(
        private readonly RequestPresenter $presenter,
        private readonly BalanceLedger $ledger,
    ) {}

    public function index(Request $http, #[CurrentUser] User $user): Response
    {
        Gate::authorize('viewAny', EmployeeRequest::class);

        $filter = $http->query('status');
        $filter = is_string($filter) && isset(self::FILTERS[$filter]) ? $filter : 'semua';

        $counts = EmployeeRequest::query()->ownedBy($user)
            ->toBase()
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $count = fn (array $statuses): int => (int) collect($statuses)->sum(fn (RequestStatus $status): int => (int) ($counts[$status->value] ?? 0));

        $statuses = self::FILTERS[$filter] ?? null;
        $items = EmployeeRequest::query()
            ->ownedBy($user)
            ->with(['leaveType', 'user.position', 'user.division', 'approvals.approver'])
            ->when($statuses !== null, fn (Builder $query) => $query->whereIn('status', RequestStatus::values($statuses ?? [])))
            ->latest('created_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        $selectedId = $http->query('pilih');
        $selected = is_string($selectedId)
            ? EmployeeRequest::query()->with(['leaveType', 'user'])->find($selectedId)
            : $items->first();

        return Inertia::render('requests/index', [
            'filter' => $filter,
            'counts' => [
                'semua' => (int) $counts->sum(),
                'menunggu' => $count(self::FILTERS['menunggu']),
                'disetujui' => $count(self::FILTERS['disetujui']),
                'ditolak' => $count(self::FILTERS['ditolak']),
            ],
            'requests' => $items->map(fn (EmployeeRequest $request): array => $this->presenter->item($request))->values()->all(),
            'selected' => $selected !== null && Gate::allows('view', $selected) ? $this->presenter->detail($selected, $user) : null,
            'balances' => $this->balanceCards($user),
            'since' => EmployeeRequest::query()->ownedBy($user)->min('created_at'),
        ]);
    }

    public function create(Request $http, #[CurrentUser] User $user): Response
    {
        Gate::authorize('create', EmployeeRequest::class);

        $category = RequestCategory::fromSlug(is_string($http->query('kategori')) ? $http->query('kategori') : null) ?? RequestCategory::Leave;

        return Inertia::render('requests/form', [
            ...$this->formProps($user),
            'request' => null,
            'initial' => ['category' => $category->value],
        ]);
    }

    public function store(SaveEmployeeRequestRequest $form, #[CurrentUser] User $user, SubmitRequest $submit, SaveRequestDraft $draft): RedirectResponse
    {
        Gate::authorize('create', EmployeeRequest::class);

        if ($form->isDraft()) {
            $request = $draft->handle($user, $form->toInput());
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Draf tersimpan.']);

            return to_route('requests.edit', ['employeeRequest' => $request->id]);
        }

        $request = $submit->handle($user, $form->toInput());

        return $this->submitted($request);
    }

    public function show(#[CurrentUser] User $user, EmployeeRequest $employeeRequest): Response
    {
        Gate::authorize('view', $employeeRequest);

        return Inertia::render('requests/show', [
            'request' => $this->presenter->detail($employeeRequest, $user),
        ]);
    }

    public function edit(#[CurrentUser] User $user, EmployeeRequest $employeeRequest): Response
    {
        Gate::authorize('update', $employeeRequest);

        $employeeRequest->load(['leaveType', 'user', 'approvals.approver']);
        $payload = $employeeRequest->payload;
        $start = OfficeTime::local($employeeRequest->start_at);
        $end = OfficeTime::local($employeeRequest->end_at);

        return Inertia::render('requests/form', [
            ...$this->formProps($user),
            'request' => $this->presenter->detail($employeeRequest, $user),
            'initial' => [
                'category' => $employeeRequest->leaveType->category->value,
                'leave_type_id' => $employeeRequest->leave_type_id,
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
                'date' => $payload['date'] ?? $start->toDateString(),
                'start_time' => $payload['start_time'] ?? null,
                'end_time' => $payload['end_time'] ?? null,
                'check_in' => $payload['check_in'] ?? null,
                'check_out' => $payload['check_out'] ?? null,
                'half_day' => (bool) ($payload['half_day'] ?? false),
                'destination' => $payload['destination'] ?? null,
                'substitute_id' => $employeeRequest->substitute_id,
                'reason' => $employeeRequest->reason,
            ],
        ]);
    }

    public function update(SaveEmployeeRequestRequest $form, #[CurrentUser] User $user, EmployeeRequest $employeeRequest, SubmitRequest $submit, SaveRequestDraft $draft): RedirectResponse
    {
        Gate::authorize('update', $employeeRequest);

        if ($form->isDraft()) {
            $draft->handle($user, $form->toInput(), $employeeRequest);
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Perubahan tersimpan.']);

            return to_route('requests.edit', ['employeeRequest' => $employeeRequest->id]);
        }

        return $this->submitted($submit->handle($user, $form->toInput(), $employeeRequest));
    }

    public function cancel(#[CurrentUser] User $user, EmployeeRequest $employeeRequest, CancelRequest $cancel): RedirectResponse
    {
        Gate::authorize('cancel', $employeeRequest);

        $request = $cancel->handle($user, $employeeRequest);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengajuan '.($request->number ?? 'draf').' dibatalkan.']);

        return to_route('requests.index', ['pilih' => $request->id]);
    }

    /**
     * Streams an attachment from the private disk (never a public URL). Audited.
     */
    public function attachment(EmployeeRequest $employeeRequest, Attachment $attachment, RequestAttachmentStore $store, AuditLogger $audit): StreamedResponse
    {
        Gate::authorize('viewAttachment', $employeeRequest);

        $path = $attachment->storage_path;

        if ($path === null || ! $store->disk()->exists($path)) {
            abort(404);
        }

        $audit->log('request.attachment_viewed', $employeeRequest, null, ['attachment_id' => $attachment->id, 'filename' => $attachment->filename]);

        return $store->disk()->response($path, $attachment->filename, [
            'Content-Type' => $attachment->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function submitted(EmployeeRequest $request): RedirectResponse
    {
        $request->loadMissing('approvals.approver');
        $step = $request->waitingStep();
        $to = $step === null ? '' : ' ke '.($step->approver->name ?? $step->stepLabel());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Pengajuan {$request->number} terkirim{$to}."]);

        return to_route('requests.index', ['pilih' => $request->id]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formProps(User $user): array
    {
        $types = LeaveType::query()->visibleTo($user)->active()->ordered()->get();
        $year = OfficeTime::today()->year;

        $categories = collect(RequestCategory::cases())
            ->map(function (RequestCategory $category) use ($types, $user, $year): ?array {
                $ofCategory = $types->filter(fn (LeaveType $type): bool => $type->category === $category);

                if ($ofCategory->isEmpty()) {
                    return null;
                }

                return [
                    'value' => $category->value,
                    'label' => $category->label(),
                    'slug' => $category->slug(),
                    'types' => $ofCategory->map(fn (LeaveType $type): array => [
                        ...RequestPresenter::type($type),
                        'eligible' => $type->isEligible($user),
                        'balance' => RequestPresenter::balance($this->ledger->peek($user, $type, $year)),
                    ])->values()->all(),
                ];
            })
            ->filter()
            ->values()
            ->all();

        $substitutes = User::query()
            ->active()
            ->where('company_id', $user->company_id)
            ->whereKeyNot($user->id)
            ->when($user->division_id !== null, fn (Builder $query) => $query->where('division_id', $user->division_id))
            ->orderBy('name')
            ->limit(200)
            ->get(['id', 'name', 'avatar_url'])
            ->map(fn (User $person): array => ['id' => $person->id, 'name' => $person->name, 'avatar' => $person->avatar_url])
            ->values()
            ->all();

        return [
            'categories' => $categories,
            'substitutes' => $substitutes,
            'today' => OfficeTime::todayString(),
            'limits' => [
                'reason' => config()->integer('requests.reason_max_length', 500),
                'max_files' => config()->integer('requests.attachments.max_files', 5),
                'max_kilobytes' => config()->integer('requests.attachments.max_kilobytes', 5120),
            ],
        ];
    }

    /**
     * Cards above the list: yearly balances, eligibility, sick-leave rule.
     *
     * @return list<array<string, mixed>>
     */
    private function balanceCards(User $user): array
    {
        $year = OfficeTime::today()->year;

        return array_values(LeaveType::query()
            ->visibleTo($user)
            ->active()
            ->whereIn('category', [RequestCategory::Leave->value, RequestCategory::Sick->value])
            ->ordered()
            ->get()
            ->map(function (LeaveType $type) use ($user, $year): array {
                $eligible = $type->isEligible($user);
                $pending = $type->hasQuota() && $eligible
                    ? EmployeeRequest::query()->ownedBy($user)->where('leave_type_id', $type->id)->where('status', RequestStatus::Pending->value)->orderBy('start_at')->first()
                    : null;

                return [
                    'type' => RequestPresenter::type($type),
                    'kind' => ! $eligible ? 'ineligible' : ($type->hasQuota() ? 'balance' : 'info'),
                    'year' => $year,
                    'balance' => $eligible ? RequestPresenter::balance($this->ledger->peek($user, $type, $year)) : null,
                    'pending_request' => $pending === null ? null : [
                        'id' => $pending->id,
                        'start_at' => $pending->start_at->toIso8601String(),
                        'end_at' => $pending->end_at->toIso8601String(),
                        'days' => $pending->days,
                    ],
                ];
            })
            ->all());
    }
}
