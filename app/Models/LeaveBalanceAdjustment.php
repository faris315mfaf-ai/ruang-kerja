<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One HR adjustment of a leave balance (+/− days with a mandatory reason).
 * Append-only; written only by App\Domain\Requests\Actions\AdjustLeaveBalance,
 * which also keeps leave_balances.adjustment_days = Σ delta_days.
 *
 * @property string $id
 * @property string $balance_id
 * @property float $delta_days
 * @property string $reason
 * @property string|null $actor_id
 * @property Carbon|null $created_at
 * @property-read LeaveBalance $balance
 * @property-read User|null $actor
 */
#[Fillable(['balance_id', 'delta_days', 'reason', 'actor_id'])]
class LeaveBalanceAdjustment extends Model
{
    use HasUlids;

    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'delta_days' => 'float',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<LeaveBalance, $this>
     */
    public function balance(): BelongsTo
    {
        return $this->belongsTo(LeaveBalance::class, 'balance_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
