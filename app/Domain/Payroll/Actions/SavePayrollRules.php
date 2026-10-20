<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Payroll\Models\PayrollRule;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Pay rules of the actor's company (which absences are paid, deduction per
 * late day). Locked months keep the rules of their snapshot. Audited as
 * `payroll.rules_saved`.
 */
final class SavePayrollRules
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int}  $rules
     */
    public function handle(User $actor, array $rules): PayrollRule
    {
        [$rule, $old] = DB::transaction(function () use ($actor, $rules): array {
            $rule = PayrollRule::query()->whereKey($actor->company_id)->lockForUpdate()->first()
                ?? new PayrollRule(['company_id' => $actor->company_id]);
            $old = $rule->exists ? $rule->toRules() : null;

            $rule->fill([...$rules, 'updated_by' => $actor->id])->save();

            return [$rule, $old];
        });

        $this->audit->log('payroll.rules_saved', $rule, $old, $rule->toRules(), $actor);

        return $rule;
    }
}
