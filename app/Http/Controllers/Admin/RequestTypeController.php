<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Data\StepDefinition;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\ConditionMetric;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Services\ApprovalFlowResolver;
use App\Domain\Requests\Services\ConditionEvaluator;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin › Jenis pengajuan & alur persetujuan (desktop only; mockup AlurApproval).
 */
class RequestTypeController extends Controller
{
    public function index(Request $http, #[CurrentUser] User $user): Response
    {
        Gate::authorize('viewAny', ApprovalFlow::class);

        $flows = ApprovalFlow::query()->visibleTo($user)->with(['steps.approverUser'])->withCount('leaveTypes')->orderBy('name')->get();
        $types = LeaveType::query()->visibleTo($user)->ordered()->get();

        $roleHolders = collect(Role::cases())->mapWithKeys(fn (Role $role): array => [
            $role->value => User::query()->active()->where('company_id', $user->company_id)
                ->whereHas('roles', fn ($query) => $query->where('name', $role->value))
                ->orderBy('name')->pluck('name')->values()->all(),
        ]);

        return Inertia::render('admin/request-types', [
            'types' => $types->map(fn (LeaveType $type): array => [
                ...RequestPresenter::type($type),
                'approval_flow_id' => $type->approval_flow_id,
                'carry_over_max_days' => $type->carry_over_max_days,
                'min_service_months' => $type->min_service_months,
                'is_active' => $type->is_active,
                'sort_order' => $type->sort_order,
            ])->values()->all(),
            'flows' => $flows->map(fn (ApprovalFlow $flow): array => [
                'id' => $flow->id,
                'name' => $flow->name,
                'is_default' => $flow->name === ApprovalFlow::DEFAULT_NAME,
                'skip_self_approval' => $flow->skip_self_approval,
                'allow_delegation' => $flow->allow_delegation,
                'leave_types_count' => $flow->leave_types_count,
                'updated_at' => $flow->updated_at?->toIso8601String(),
                'steps' => $flow->steps->map(fn (ApprovalFlowStep $step): array => [
                    'approver_type' => $step->approver_type->value,
                    'approver_role' => $step->approver_role,
                    'approver_user_id' => $step->approver_user_id,
                    'approver_user_name' => $step->approverUser?->name,
                    'condition' => $step->condition,
                ])->values()->all(),
            ])->values()->all(),
            'selected' => is_string($http->query('jenis')) ? $http->query('jenis') : $types->first()?->id,
            'options' => [
                'categories' => RequestCategory::options(),
                'approver_types' => ApproverType::options(),
                'roles' => Role::options(),
                'metrics' => ConditionMetric::options(),
                'role_holders' => $roleHolders,
                'users' => User::query()->active()->where('company_id', $user->company_id)->orderBy('name')
                    ->get(['id', 'name'])->map(fn (User $person): array => ['id' => $person->id, 'name' => $person->name])->values()->all(),
            ],
        ]);
    }

    /**
     * Preview of (unsaved) steps for a sample employee: who would decide, which
     * steps are skipped and why. Read-only.
     */
    public function preview(Request $http, #[CurrentUser] User $user, ApprovalFlowResolver $flows, ConditionEvaluator $conditions): JsonResponse
    {
        Gate::authorize('viewAny', ApprovalFlow::class);

        $type = LeaveType::query()->visibleTo($user)->find((string) $http->query('leave_type_id'));
        $sample = User::query()->active()->where('company_id', $user->company_id)->find((string) $http->query('user_id'));

        if ($type === null || $sample === null) {
            return response()->json(['message' => 'Pilih jenis dan contoh karyawan.'], 422);
        }

        $definitions = [];
        $steps = $http->query('steps');

        foreach (is_array($steps) ? $steps : [] as $step) {
            if (! is_array($step)) {
                continue;
            }

            $kind = ApproverType::tryFrom((string) ($step['approver_type'] ?? ''));

            if ($kind === null) {
                continue;
            }

            $condition = [];

            foreach (is_array($step['condition'] ?? null) ? $step['condition'] : [] as $key => $value) {
                if (ConditionEvaluator::parseKey((string) $key) !== null && is_numeric($value)) {
                    $condition[(string) $key] = (float) $value;
                }
            }

            $definitions[] = new StepDefinition(
                $kind,
                $kind === ApproverType::Role ? (string) ($step['approver_role'] ?? '') : null,
                $kind === ApproverType::User ? (string) ($step['approver_user_id'] ?? '') : null,
                $condition === [] ? null : $condition,
            );
        }

        $today = OfficeTime::today();
        $request = new EmployeeRequest([
            'user_id' => $sample->id,
            'leave_type_id' => $type->id,
            'start_at' => $today->utc(),
            'end_at' => $today->endOfDay()->utc(),
            'days' => $type->category->isAbsence() ? 1 : null,
            'minutes' => null,
            'payload' => [],
        ]);
        $request->setRelation('user', $sample);
        $request->setRelation('leaveType', $type);

        return response()->json([
            'sample' => ['id' => $sample->id, 'name' => $sample->name],
            'overtime_month_minutes' => $conditions->overtimeMonthMinutes($request),
            'steps' => RequestPresenter::plannedSteps($flows->previewSteps(
                $request,
                $definitions,
                $http->boolean('skip_self_approval', true),
                $http->boolean('allow_delegation', true),
            )),
        ]);
    }
}
