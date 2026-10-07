<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Moves days between pending and used on leave_balances, always under a row lock
 * (call inside a DB transaction). Only leave types with an annual quota have a
 * balance; for the others every method is a no-op.
 *
 *   submit   → reserve  (pending += days)
 *   approve  → consume  (pending -= days, used += days)
 *   reject / revision / cancel → release (pending -= days)
 *   approved request voided by HR → refund (used -= days)
 */
final class BalanceLedger
{
    public function __construct(private readonly LeaveEntitlement $entitlement) {}

    /**
     * Balance row of the request's year, created from the type quota (prorated
     * for a mid-year joiner, see LeaveEntitlement) when missing.
     */
    public function balanceFor(User $user, LeaveType $type, int $year, bool $lock = false): ?LeaveBalance
    {
        if (! $type->hasQuota()) {
            return null;
        }

        LeaveBalance::query()->firstOrCreate(
            ['user_id' => $user->id, 'leave_type_id' => $type->id, 'year' => $year],
            ['entitled_days' => $this->entitlement->forYear($user, $type, $year)],
        );

        return LeaveBalance::query()
            ->where(['user_id' => $user->id, 'leave_type_id' => $type->id, 'year' => $year])
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->firstOrFail();
    }

    /**
     * Read-only balance (no row is created) for summaries.
     */
    public function peek(User $user, LeaveType $type, int $year): ?LeaveBalance
    {
        if (! $type->hasQuota()) {
            return null;
        }

        return LeaveBalance::query()
            ->where(['user_id' => $user->id, 'leave_type_id' => $type->id, 'year' => $year])
            ->first()
            ?? new LeaveBalance([
                'user_id' => $user->id,
                'leave_type_id' => $type->id,
                'year' => $year,
                'entitled_days' => $this->entitlement->forYear($user, $type, $year),
            ]);
    }

    /**
     * @throws ValidationException when the balance is insufficient
     */
    public function reserve(EmployeeRequest $request): void
    {
        $balance = $this->lockedBalance($request);
        $days = (float) ($request->days ?? 0);

        if ($balance === null || $days <= 0) {
            return;
        }

        if ($balance->available() < $days) {
            throw ValidationException::withMessages([
                'start_date' => sprintf(
                    'Saldo %s tidak cukup: sisa %s hari, diajukan %s hari.',
                    mb_strtolower($request->leaveType->name),
                    self::format($balance->available()),
                    self::format($days),
                ),
            ]);
        }

        $balance->pending_days = round($balance->pending_days + $days, 1);
        $balance->save();
    }

    public function release(EmployeeRequest $request): void
    {
        $balance = $this->lockedBalance($request);
        $days = (float) ($request->days ?? 0);

        if ($balance === null || $days <= 0) {
            return;
        }

        $balance->pending_days = max(0, round($balance->pending_days - $days, 1));
        $balance->save();
    }

    public function consume(EmployeeRequest $request): void
    {
        $balance = $this->lockedBalance($request);
        $days = (float) ($request->days ?? 0);

        if ($balance === null || $days <= 0) {
            return;
        }

        $balance->pending_days = max(0, round($balance->pending_days - $days, 1));
        $balance->used_days = round($balance->used_days + $days, 1);
        $balance->save();
    }

    /**
     * Gives back the days an approved request used (CancelApprovedRequest).
     * Returns the refunded days (0 for a type without a quota).
     */
    public function refund(EmployeeRequest $request): float
    {
        $balance = $this->lockedBalance($request);
        $days = (float) ($request->days ?? 0);

        if ($balance === null || $days <= 0) {
            return 0.0;
        }

        $refunded = min($days, (float) $balance->used_days);
        $balance->used_days = max(0, round($balance->used_days - $days, 1));
        $balance->save();

        return round($refunded, 1);
    }

    public static function yearOf(EmployeeRequest $request): int
    {
        return (int) OfficeTime::local($request->start_at)->year;
    }

    public static function format(float $days): string
    {
        return rtrim(rtrim(number_format($days, 1, ',', '.'), '0'), ',');
    }

    private function lockedBalance(EmployeeRequest $request): ?LeaveBalance
    {
        $request->loadMissing(['user', 'leaveType']);

        return $this->balanceFor($request->user, $request->leaveType, self::yearOf($request), lock: true);
    }
}
