<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Services\BalanceLedger;
use App\Models\LeaveBalance;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Admin HR: set an employee's entitlement / carry-over / opening balance
 * ("saldo awal"; null = unchanged). The total (incl. adjustments) never drops
 * below what is already used or reserved.
 */
final class UpdateLeaveBalance
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, LeaveBalance $balance, float $entitled, float $carriedOver, ?float $opening = null): LeaveBalance
    {
        return DB::transaction(function () use ($actor, $balance, $entitled, $carriedOver, $opening): LeaveBalance {
            $locked = LeaveBalance::query()->lockForUpdate()->findOrFail($balance->id);
            $opening ??= $locked->opening_days;
            $before = ['entitled_days' => $locked->entitled_days, 'carried_over_days' => $locked->carried_over_days, 'opening_days' => $locked->opening_days];
            $committed = $locked->used_days + $locked->pending_days;

            if (round($entitled + $carriedOver + $opening + $locked->adjustment_days, 1) < round($committed, 1)) {
                throw ValidationException::withMessages([
                    'entitled_days' => 'Jatah tidak boleh kurang dari yang sudah terpakai/diajukan ('.BalanceLedger::format($committed).' hari).',
                ]);
            }

            // HR's carry-over is final: the yearly generator will not overwrite it.
            $locked->fill([
                'entitled_days' => $entitled,
                'carried_over_days' => $carriedOver,
                'opening_days' => $opening,
                'generated_at' => $locked->generated_at ?? now(),
            ])->save();

            $this->audit->log('leave_balance.updated', $locked, $before, [
                'entitled_days' => $locked->entitled_days,
                'carried_over_days' => $locked->carried_over_days,
                'opening_days' => $locked->opening_days,
            ], $actor);

            return $locked;
        });
    }
}
