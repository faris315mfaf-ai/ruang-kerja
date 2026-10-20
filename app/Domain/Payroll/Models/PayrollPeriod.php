<?php

namespace App\Domain\Payroll\Models;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One payroll month of a company. Locked (locked_at set) = attendance and
 * wages of that month are frozen and the report shows `snapshot`.
 *
 * @property string $id
 * @property string $company_id
 * @property CarbonImmutable $month
 * @property CarbonImmutable|null $locked_at
 * @property string|null $locked_by
 * @property array<string, mixed>|null $snapshot
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User|null $locker
 */
#[Fillable(['company_id', 'month', 'locked_at', 'locked_by', 'snapshot'])]
class PayrollPeriod extends Model
{
    use HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'month' => 'immutable_date',
            'locked_at' => 'immutable_datetime',
            'snapshot' => 'array',
        ];
    }

    public function isLocked(): bool
    {
        return $this->locked_at !== null;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function locker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }
}
