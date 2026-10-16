<?php

namespace App\Http\Controllers\Api\Requests;

use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Api\SubmitEmployeeRequestRequest;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * "Pengajuan saya" of the mobile app. The list and the submit run through the
 * web row presenter, FormRequest and SubmitRequest action — the approval
 * flow, numbering, balance reservation and approver notifications behave
 * exactly like the web. The type catalogue carries the web form's flags plus
 * per-type field hints; locked types are listed (bergembok, with the reason)
 * and refused on submit/draft by the web machinery. Staff never receive a
 * balance field (keputusan pemilik 6 Okt 2026). Drafts, detail, cancel,
 * attachments and approvals: MyRequestController & co. (B4-A).
 */
class RequestController extends Controller
{
    /**
     * Status chips → statuses (same as the web list; draf/dibatalkan extra).
     *
     * @var array<string, list<RequestStatus>>
     */
    private const array FILTERS = [
        'menunggu' => [RequestStatus::Pending, RequestStatus::RevisionRequested],
        'disetujui' => [RequestStatus::Approved],
        'ditolak' => [RequestStatus::Rejected],
        'revisi' => [RequestStatus::RevisionRequested],
        'draf' => [RequestStatus::Draft],
        'dibatalkan' => [RequestStatus::Canceled],
    ];

    public function __construct(
        private readonly RequestPresenter $presenter,
        private readonly BalanceLedger $ledger,
    ) {}

    /**
     * The caller's own requests, newest first, 20 per page.
     * Filters: ?status=semua|menunggu|disetujui|ditolak|revisi|draf|dibatalkan,
     * ?jenis=<category slug/value or leave type id>, ?tahun=YYYY (start date,
     * office time). `counts` follow jenis/tahun but not status (chip badges).
     */
    public function index(Request $http, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', EmployeeRequest::class);

        $status = $http->query('status');
        $status = is_string($status) && isset(self::FILTERS[$status]) ? $status : 'semua';
        $jenis = $http->query('jenis');
        $jenis = is_string($jenis) && $jenis !== '' ? $jenis : null;
        $tahun = $http->query('tahun');
        $tahun = is_string($tahun) && preg_match('/^\d{4}$/', $tahun) === 1 ? (int) $tahun : null;

        $scoped = fn (): Builder => EmployeeRequest::query()
            ->ownedBy($user)
            ->when($jenis !== null, fn (Builder $query) => self::filterJenis($query, (string) $jenis))
            ->when($tahun !== null, fn (Builder $query) => $query
                ->where('start_at', '>=', OfficeTime::startOfDay("{$tahun}-01-01"))
                ->where('start_at', '<=', OfficeTime::endOfDay("{$tahun}-12-31")));

        $counts = $scoped()->toBase()
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');
        $count = fn (array $statuses): int => (int) collect($statuses)->sum(fn (RequestStatus $case): int => (int) ($counts[$case->value] ?? 0));

        /** @var LengthAwarePaginator<int, EmployeeRequest> $requests */
        $requests = $scoped()
            ->with(['leaveType', 'user.position', 'user.division', 'approvals.approver'])
            ->when($status !== 'semua', fn (Builder $query) => $query->whereIn('status', RequestStatus::values(self::FILTERS[$status] ?? [])))
            ->latest('created_at')
            ->orderByDesc('id')
            ->paginate(20);

        $response = [
            'requests' => array_map(
                fn (EmployeeRequest $request): array => $this->presenter->item($request),
                $requests->items(),
            ),
            'meta' => [
                'current_page' => $requests->currentPage(),
                'from' => $requests->firstItem(),
                'last_page' => $requests->lastPage(),
                'per_page' => $requests->perPage(),
                'to' => $requests->lastItem(),
                'total' => $requests->total(),
            ],
            'filter' => ['status' => $status, 'jenis' => $jenis, 'tahun' => $tahun],
            'counts' => [
                'semua' => (int) $counts->sum(),
                ...array_map(fn (array $statuses): int => $count($statuses), self::FILTERS),
            ],
        ];

        // Staff never get any balance (keputusan pemilik 6 Okt 2026).
        if (! $user->isStaffOnly()) {
            $response['balances'] = $this->balanceCards($user);
        }

        return response()->json($response);
    }

    /**
     * The form's catalogue: every visible active LeaveType of the company per
     * category, locked ones included (`locked`, `locked_reason`) and the
     * caller's eligibility (`eligible`), each with field hints the web form
     * derives from category + flags. Non-staff also get their balance per
     * type with a quota; staff never get a `balance` key.
     */
    public function types(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('create', EmployeeRequest::class);

        $types = LeaveType::query()->visibleTo($user)->active()->ordered()->get();
        $year = OfficeTime::today()->year;
        $staff = $user->isStaffOnly();
        $categories = [];

        foreach (RequestCategory::cases() as $category) {
            $ofCategory = $types->filter(fn (LeaveType $type): bool => $type->category === $category)->values();

            if ($ofCategory->isEmpty()) {
                continue;
            }

            $rows = array_map(function (LeaveType $type) use ($user, $year, $staff): array {
                $row = [
                    ...RequestPresenter::type($type),
                    'eligible' => $type->isEligible($user),
                    'ineligible_reason' => $type->isEligible($user) ? null : "Anda belum berhak atas {$type->name}.",
                    'needs_substitute' => $type->category === RequestCategory::Leave,
                    'modes' => $type->category === RequestCategory::Permit ? ['days', 'hours'] : null,
                    'fields' => self::fields($type),
                ];

                if (! $staff) {
                    $row['balance'] = $type->hasQuota() ? RequestPresenter::balance($this->ledger->peek($user, $type, $year)) : null;
                }

                return $row;
            }, $ofCategory->all());

            $categories[] = [
                'value' => $category->value,
                'label' => $category->label(),
                'slug' => $category->slug(),
                'locked' => collect($rows)->every(fn (array $row): bool => (bool) $row['locked']),
                'types' => $rows,
            ];
        }

        $attachments = config()->array('requests.attachments');

        return response()->json([
            'categories' => $categories,
            'today' => OfficeTime::todayString(),
            'limits' => [
                'reason' => config()->integer('requests.reason_max_length', 500),
                'max_files' => (int) ($attachments['max_files'] ?? 5),
                'max_kilobytes' => (int) ($attachments['max_kilobytes'] ?? 5120),
                'mimes' => array_values((array) ($attachments['mimes'] ?? [])),
            ],
        ]);
    }

    /**
     * Submit a new request ({type, ...payload}; multipart for attachments[]);
     * 201 with the created row.
     */
    public function store(SubmitEmployeeRequestRequest $form, #[CurrentUser] User $user, SubmitRequest $submit): JsonResponse
    {
        Gate::authorize('create', EmployeeRequest::class);

        $request = $submit->handle($user, $form->toInput());
        $request->loadMissing(['leaveType', 'user.position', 'user.division', 'approvals.approver']);

        return response()->json(['request' => $this->presenter->item($request)], 201);
    }

    /**
     * Field hints per type (web form logic of request-form.tsx): which inputs
     * to show, per izin mode for permits. Required-ness is checked by the server.
     *
     * @return array<string, list<string>>|list<string>
     */
    private static function fields(LeaveType $type): array
    {
        $attachment = $type->requires_attachment_after_days !== null ? ['attachments'] : [];
        $halfDay = $type->allow_half_day ? ['half_day'] : [];

        return match ($type->category) {
            RequestCategory::Leave => ['start_date', 'end_date', ...$halfDay, 'substitute_id', 'reason', ...$attachment],
            RequestCategory::Permit => [
                'days' => ['start_date', 'end_date', ...$halfDay, 'reason', ...$attachment],
                'hours' => ['date', 'start_time', 'end_time', 'reason', ...$attachment],
            ],
            RequestCategory::Sick => ['start_date', 'end_date', ...$halfDay, 'reason', 'attachments'],
            RequestCategory::Overtime => ['date', 'start_time', 'end_time', 'reason'],
            RequestCategory::Correction => ['date', 'check_in', 'check_out', 'reason'],
            RequestCategory::BusinessTrip => ['start_date', 'end_date', 'destination', 'reason', 'attachments'],
            RequestCategory::Procurement => ['item_name', 'quantity', 'unit', 'unit_price', 'reference_url', 'urgency', 'reason'],
        };
    }

    /**
     * @param  Builder<EmployeeRequest>  $query
     */
    private static function filterJenis(Builder $query, string $jenis): void
    {
        $category = RequestCategory::fromSlug($jenis);

        if ($category !== null) {
            $query->whereHas('leaveType', fn (Builder $type) => $type->where('category', $category->value));

            return;
        }

        $query->where('leave_type_id', $jenis);
    }

    /**
     * Balance cards above the list for non-staff (same data as the web
     * "Pengajuan saya" cards): yearly balances of leave/sick types.
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

                return [
                    'type' => RequestPresenter::type($type),
                    'kind' => ! $eligible ? 'ineligible' : ($type->hasQuota() ? 'balance' : 'info'),
                    'year' => $year,
                    'balance' => $eligible ? RequestPresenter::balance($this->ledger->peek($user, $type, $year)) : null,
                ];
            })
            ->all());
    }
}
