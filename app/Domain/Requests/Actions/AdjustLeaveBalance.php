<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Services\BalanceLedger;
use App\Models\LeaveBalance;
use App\Models\LeaveBalanceAdjustment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Admin HR: add (+) or take back (−) days on a balance with a mandatory reason.
 * Appends to leave_balance_adjustments and keeps leave_balances.adjustment_days
 * = Σ delta under a row lock; the available balance never goes negative.
 * Audited (`leave_balance.adjusted`).
 */
final class AdjustLeaveBalance
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, LeaveBalance $balance, float $delta, string $reason): LeaveBalanceAdjustment
    {
        $reason = trim($reason);
        $delta = round($delta, 1);

        if ($reason === '') {
            throw ValidationException::withMessages(['reason' => 'Alasan penyesuaian wajib diisi.']);
        }

        if ($delta === 0.0 || fmod(abs($delta) * 2, 1.0) !== 0.0) {
            throw ValidationException::withMessages(['delta_days' => 'Isi penyesuaian kelipatan 0,5 hari, tidak boleh 0.']);
        }

        return DB::transaction(function () use ($actor, $balance, $delta, $reason): LeaveBalanceAdjustment {
            $locked = LeaveBalance::query()->lockForUpdate()->findOrFail($balance->id);

            if (round($locked->available() + $delta, 1) < 0) {
                throw ValidationException::withMessages([
                    'delta_days' => 'Saldo tidak boleh minus: sisa yang bisa dikurangi '.BalanceLedger::format(max(0.0, $locked->available())).' hari.',
                ]);
            }

            $before = $locked->adjustment_days;
            $locked->adjustment_days = round($before + $delta, 1);
            $locked->save();

            $adjustment = LeaveBalanceAdjustment::query()->create([
                'balance_id' => $locked->id,
                'delta_days' => $delta,
                'reason' => $reason,
                'actor_id' => $actor->id,
            ]);

            $this->audit->log('leave_balance.adjusted', $locked, ['adjustment_days' => $before], [
                'adjustment_days' => $locked->adjustment_days,
                'adjustment_id' => $adjustment->id,
                'delta_days' => $delta,
                'reason' => $reason,
            ], $actor);

            return $adjustment;
        });
    }
}
