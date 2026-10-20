<?php

namespace App\Domain\Payroll\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Pay rules of one company (gaji harian): which absences are paid and the
 * deduction per late day. A company without a row uses the defaults.
 *
 * @property string $company_id
 * @property bool $pay_leave
 * @property bool $pay_sick
 * @property bool $pay_permit
 * @property int $late_deduction
 * @property string|null $updated_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['company_id', 'pay_leave', 'pay_sick', 'pay_permit', 'late_deduction', 'updated_by'])]
class PayrollRule extends Model
{
    protected $primaryKey = 'company_id';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var array<string, mixed> */
    protected $attributes = [
        'pay_leave' => true,
        'pay_sick' => true,
        'pay_permit' => false,
        'late_deduction' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'pay_leave' => 'boolean',
            'pay_sick' => 'boolean',
            'pay_permit' => 'boolean',
            'late_deduction' => 'integer',
        ];
    }

    /**
     * The company's rules, or the defaults (unsaved) when HR never set them.
     */
    public static function forCompany(string $companyId): self
    {
        return self::query()->find($companyId) ?? new self(['company_id' => $companyId]);
    }

    /**
     * @return array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int}
     */
    public function toRules(): array
    {
        return [
            'pay_leave' => $this->pay_leave,
            'pay_sick' => $this->pay_sick,
            'pay_permit' => $this->pay_permit,
            'late_deduction' => $this->late_deduction,
        ];
    }
}
