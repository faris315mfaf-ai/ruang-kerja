<?php

namespace App\Http\Controllers\Api\Requests;

use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Enums\RequestCategory;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Api\SubmitEmployeeRequestRequest;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * "Pengajuan saya" of the mobile app (Tahap 1). The list and the submit run
 * through the web row presenter, FormRequest and SubmitRequest action — the
 * approval flow, numbering, balance reservation and approver notifications
 * behave exactly like the web. Drafts, editing, cancel and approvals stay on
 * the web for now. There is no per-type field schema beyond the LeaveType
 * flags of RequestPresenter::type (allow_half_day, day_unit,
 * requires_attachment_after_days, …) plus the category — the client picks
 * its form fields from them, like the web form does.
 */
class RequestController extends Controller
{
    public function __construct(private readonly RequestPresenter $presenter) {}

    /**
     * The caller's own requests, newest first, 20 per page.
     */
    public function index(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', EmployeeRequest::class);

        /** @var LengthAwarePaginator<int, EmployeeRequest> $requests */
        $requests = EmployeeRequest::query()
            ->ownedBy($user)
            ->with(['leaveType', 'user.position', 'user.division', 'approvals.approver'])
            ->latest('created_at')
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json([
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
        ]);
    }

    /**
     * Types the caller may request (the form's category list): visible and
     * active LeaveTypes of the company, without the locked ones and without
     * those the caller is not eligible for — locked/ineligible submissions
     * are refused by SubmitRequest anyway.
     */
    public function types(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('create', EmployeeRequest::class);

        $types = LeaveType::query()
            ->visibleTo($user)
            ->active()
            ->whereNull('locked_reason')
            ->ordered()
            ->get()
            ->filter(fn (LeaveType $type): bool => $type->isEligible($user));

        $categories = [];

        foreach (RequestCategory::cases() as $category) {
            $ofCategory = $types->filter(fn (LeaveType $type): bool => $type->category === $category);

            if ($ofCategory->isEmpty()) {
                continue;
            }

            $categories[] = [
                'value' => $category->value,
                'label' => $category->label(),
                'slug' => $category->slug(),
                'types' => array_map(
                    fn (LeaveType $type): array => RequestPresenter::type($type),
                    $ofCategory->values()->all(),
                ),
            ];
        }

        return response()->json(['categories' => $categories]);
    }

    /**
     * Submit a new request ({type, ...payload}); 201 with the created row.
     */
    public function store(SubmitEmployeeRequestRequest $form, #[CurrentUser] User $user, SubmitRequest $submit): JsonResponse
    {
        Gate::authorize('create', EmployeeRequest::class);

        $request = $submit->handle($user, $form->toInput());
        $request->loadMissing(['leaveType', 'user.position', 'user.division', 'approvals.approver']);

        return response()->json(['request' => $this->presenter->item($request)], 201);
    }
}
