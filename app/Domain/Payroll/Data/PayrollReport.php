<?php

namespace App\Domain\Payroll\Data;

/**
 * Gaji harian of one month (PayrollCalculator). Plain arrays, so a locked
 * month can store and return the same shape from payroll_periods.snapshot.
 *
 * rows[]:  user_id, name, division_id, division, position, employee_number,
 *          daily_wage (int|null), wage_changed_in_period, missing_wage,
 *          present_days, paid_leave_days, unpaid_days, absent_days,
 *          late_count, pending_days, paid_days, deduction, total
 * totals:  total, paid_days, unpaid_days (unpaid absences + Alpha),
 *          absent_days, pending_days, employees
 * rules:   pay_leave, pay_sick, pay_permit, late_deduction
 * period:  month, label, locked, locked_at, locked_by_name,
 *          workdays_elapsed, workdays_total, computed_at
 */
final readonly class PayrollReport
{
    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  array<string, int|float>  $totals
     * @param  array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int}  $rules
     * @param  array<string, mixed>  $period
     */
    public function __construct(
        public array $rows,
        public array $totals,
        public array $rules,
        public array $period,
    ) {}

    /**
     * @return array{rows: list<array<string, mixed>>, totals: array<string, int|float>, rules: array<string, mixed>, period: array<string, mixed>}
     */
    public function toArray(): array
    {
        return ['rows' => $this->rows, 'totals' => $this->totals, 'rules' => $this->rules, 'period' => $this->period];
    }

    /**
     * Sums of the given rows.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, int|float>
     */
    public static function totalsOf(array $rows): array
    {
        $sum = fn (string $key): int|float => self::number(array_sum(array_map(fn (array $row): int|float => $row[$key], $rows)));

        return [
            'employees' => count($rows),
            'total' => (int) $sum('total'),
            'paid_days' => $sum('paid_days'),
            'unpaid_days' => self::number($sum('unpaid_days') + $sum('absent_days')),
            'absent_days' => $sum('absent_days'),
            'pending_days' => $sum('pending_days'),
        ];
    }

    /**
     * Whole day counts stay integers (12, not 12.0); half days keep 0.5.
     */
    public static function number(int|float $value): int|float
    {
        return floor($value) === (float) $value ? (int) $value : round($value, 1);
    }
}
