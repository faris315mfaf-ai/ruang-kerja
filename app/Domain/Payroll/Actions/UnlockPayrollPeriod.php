<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Domain\Payroll\Services\PayrollLock;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Opens a locked payroll month again: the snapshot is dropped and the page
 * computes live again. Audited as `payroll.period_unlocked`.
 */
final class UnlockPayrollPeriod
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly PayrollLock $lock,
    ) {}

    /**
     * @throws ValidationException
     */
    public function handle(User $actor, RecapPeriod $period): PayrollPeriod
    {
        $record = DB::transaction(function () use ($actor, $period): PayrollPeriod {
            $record = PayrollPeriod::query()
                ->where('company_id', $actor->company_id)
                ->whereDate('month', $period->monthStart->toDateString())
                ->lockForUpdate()
                ->first();

            if ($record === null || ! $record->isLocked()) {
                throw ValidationException::withMessages(['month' => "Periode gaji {$period->label()} belum dikunci."]);
            }

            $record->fill(['locked_at' => null, 'locked_by' => null, 'snapshot' => null])->save();

            return $record;
        });

        $this->lock->forget();

        $this->audit->log('payroll.period_unlocked', $record, null, ['month' => $period->key()], $actor);

        return $record;
    }
}
