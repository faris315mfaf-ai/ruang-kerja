<?php

namespace App\Domain\Payroll\Models;

use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Factories\EmployeeWageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Daily wage of one employee from an effective office date on (gaji harian,
 * keputusan pemilik 20 Okt 2026). The wage of a date is the row with the
 * latest effective_from on or before it.
 *
 * @property string $id
 * @property string $company_id
 * @property string $user_id
 * @property int $daily_wage
 * @property CarbonImmutable $effective_from
 * @property string|null $note
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $user
 * @property-read User|null $creator
 */
#[Fillable(['company_id', 'user_id', 'daily_wage', 'effective_from', 'note', 'created_by'])]
#[UseFactory(EmployeeWageFactory::class)]
class EmployeeWage extends Model
{
    /** @use HasFactory<EmployeeWageFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'daily_wage' => 'integer',
            'effective_from' => 'immutable_date',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
