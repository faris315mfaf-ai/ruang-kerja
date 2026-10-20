<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Domain\Payroll\Queries\PayrollCalculator;
use App\Domain\Payroll\Services\PayrollLock;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Locks a payroll month of the actor's company: the report is computed now
 * (all employees the actor sees) and stored as the snapshot; from then on
 * attendance edits and wage changes dated in that month are refused
 * (PayrollLock) and the page shows the snapshot. Audited as
 * `payroll.period_locked`.
 */
final class LockPayrollPeriod
{
    public function __construct(
        private readonly PayrollCalculator $calculator,
        private readonly AuditLogger $audit,
        private readonly PayrollLock $lock,
    ) {}

    /**
     * @throws ValidationException
     */
    public function handle(User $actor, RecapPeriod $period): PayrollPeriod
    {
        $now = CarbonImmutable::now();

        if ($period->countedUntil === null) {
            throw ValidationException::withMessages(['month' => 'Bulan ini belum dimulai, jadi belum bisa dikunci.']);
        }

        $report = $this->calculator->forMonth($actor, $period, live: true);

        $record = DB::transaction(function () use ($actor, $period, $report, $now): PayrollPeriod {
            $record = PayrollPeriod::query()
                ->where('company_id', $actor->company_id)
                ->whereDate('month', $period->monthStart->toDateString())
                ->lockForUpdate()
                ->first() ?? new PayrollPeriod(['company_id' => $actor->company_id, 'month' => $period->monthStart->toDateString()]);

            if ($record->isLocked()) {
                throw ValidationException::withMessages(['month' => "Periode gaji {$period->label()} sudah dikunci."]);
            }

            $record->fill(['locked_at' => $now, 'locked_by' => $actor->id, 'snapshot' => $report->toArray()])->save();

            return $record;
        });

        $this->lock->forget();

        $this->audit->log('payroll.period_locked', $record, null, [
            'month' => $period->key(),
            'employees' => $report->totals['employees'] ?? 0,
            'total' => $report->totals['total'] ?? 0,
        ], $actor);

        return $record;
    }
}
