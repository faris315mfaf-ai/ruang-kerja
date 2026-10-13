<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Requests\Actions\AdjustLeaveBalance;
use App\Domain\Requests\Support\OfficeTime;
use App\Http\Controllers\Controller;
use App\Http\Presenters\RequestPresenter;
use App\Http\Requests\Admin\AdjustLeaveBalanceRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceAdjustment;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Admin › Saldo cuti for the Android app (HR & Super Admin,
 * requests.manage_flows — LeaveBalancePolicy, same as the web page): balances
 * of one leave type and year per employee, the adjustment history of one
 * balance, and an adjustment with a required reason (web Action
 * AdjustLeaveBalance: row lock, never negative, audit `leave_balance.adjusted`).
 * Changing the quota/opening balance, creating balances and the import stay
 * on the desktop. Staff never see annual balances here (no access at all).
 */
class LeaveBalanceController extends Controller
{
    public const int PEOPLE_LIMIT = 500;

    public function index(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', LeaveBalance::class);

        $types = LeaveType::query()->visibleTo($user)->whereNotNull('annual_quota_days')->ordered()->get();
        $type = $types->firstWhere('id', $request->query('jenis')) ?? $types->first();
        $currentYear = OfficeTime::today()->year;
        $year = (int) $request->query('tahun', (string) $currentYear);
        $year = $year >= 2000 && $year <= 2100 ? $year : $currentYear;
        $search = mb_substr(trim((string) $request->query('cari', '')), 0, 80);

        $people = User::query()
            ->visibleTo($user)
            ->active()
            ->with(['division:id,name', 'position:id,name'])
            ->when($search !== '', fn (Builder $query) => $query->where('name', 'ilike', '%'.addcslashes($search, '%_\\').'%'))
            ->orderBy('name')
            ->limit(self::PEOPLE_LIMIT)
            ->get();

        $balances = $type === null ? collect() : LeaveBalance::query()
            ->where('leave_type_id', $type->id)
            ->where('year', $year)
            ->whereIn('user_id', $people->pluck('id'))
            ->get()
            ->keyBy('user_id');

        return response()->json([
            'types' => $types->map(fn (LeaveType $t): array => RequestPresenter::type($t))->values()->all(),
            'type' => $type === null ? null : RequestPresenter::type($type),
            'year' => $year,
            'years' => range($currentYear - 2, $currentYear + 1),
            'search' => $search,
            'rows' => $people->map(function (User $person) use ($type, $balances, $year, $user): array {
                $balance = $balances->get($person->id);

                return [
                    'user' => RequestPresenter::person($person),
                    'eligible' => $type === null || $type->isEligible($person),
                    'balance' => RequestPresenter::balance($balance),
                    // Mid-year joiner: entitlement prorated (LeaveEntitlement).
                    'prorated' => $person->joined_at !== null && $person->joined_at->year === $year,
                    'joined_at' => $person->joined_at?->toDateString(),
                    'can' => ['adjust' => $balance !== null && Gate::forUser($user)->allows('update', $balance)],
                ];
            })->values()->all(),
            'web_path' => '/admin/saldo-cuti',
        ]);
    }

    /**
     * Adjustment history of one balance (latest 50).
     */
    public function history(LeaveBalance $leaveBalance): JsonResponse
    {
        Gate::authorize('viewAny', LeaveBalance::class);
        abort_unless(Gate::allows('view', $leaveBalance), 404);

        return response()->json([
            'balance' => $leaveBalance->toSummary(),
            'items' => self::adjustments($leaveBalance),
        ]);
    }

    /**
     * Add (+) or take back (−) days with a reason (audited).
     */
    public function adjust(AdjustLeaveBalanceRequest $form, LeaveBalance $leaveBalance, #[CurrentUser] User $user, AdjustLeaveBalance $adjust): JsonResponse
    {
        Gate::authorize('update', $leaveBalance);

        $adjust->handle($user, $leaveBalance, (float) $form->validated('delta_days'), (string) $form->validated('reason'));
        $leaveBalance->refresh()->loadMissing('user');

        return response()->json([
            'message' => "Penyesuaian saldo {$leaveBalance->user->name} dicatat.",
            'balance' => $leaveBalance->toSummary(),
            'items' => self::adjustments($leaveBalance),
        ]);
    }

    /**
     * @return list<array{id: string, delta_days: float, reason: string, actor: string|null, created_at: string|null}>
     */
    private static function adjustments(LeaveBalance $balance): array
    {
        return array_values($balance->adjustments()->with('actor:id,name')->latest('created_at')->orderByDesc('id')->limit(50)->get()
            ->map(fn (LeaveBalanceAdjustment $adjustment): array => [
                'id' => $adjustment->id,
                'delta_days' => (float) $adjustment->delta_days,
                'reason' => $adjustment->reason,
                'actor' => $adjustment->actor?->name,
                'created_at' => $adjustment->created_at?->toIso8601String(),
            ])->all());
    }
}
