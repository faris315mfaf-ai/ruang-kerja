<?php

namespace App\Models;

use Database\Factories\LeaveBalanceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Yearly balance of one leave type for one employee. Changed only through
 * App\Domain\Requests\Services\BalanceLedger (row lock) or the HR admin action.
 *
 * @property string $id
 * @property string $user_id
 * @property string $leave_type_id
 * @property int $year
 * @property float $entitled_days
 * @property float $carried_over_days
 * @property float $used_days
 * @property float $pending_days
 * @property Carbon|null $generated_at carry-over settled by the yearly generator or HR
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read LeaveType $leaveType
 */
#[Fillable(['user_id', 'leave_type_id', 'year', 'entitled_days', 'carried_over_days', 'used_days', 'pending_days', 'generated_at'])]
class LeaveBalance extends Model
{
    /** @use HasFactory<LeaveBalanceFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'entitled_days' => 0,
        'carried_over_days' => 0,
        'used_days' => 0,
        'pending_days' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'entitled_days' => 'float',
            'carried_over_days' => 'float',
            'used_days' => 'float',
            'pending_days' => 'float',
            'generated_at' => 'datetime',
        ];
    }

    public function total(): float
    {
        return $this->entitled_days + $this->carried_over_days;
    }

    /**
     * Days still free to request (pending requests already deducted).
     */
    public function available(): float
    {
        return round($this->total() - $this->used_days - $this->pending_days, 1);
    }

    /**
     * Remaining after approved requests only ("hari tersisa" in the mockup).
     */
    public function remaining(): float
    {
        return round($this->total() - $this->used_days, 1);
    }

    /**
     * @return array{id: string, year: int, entitled: float, carried_over: float, used: float, pending: float, total: float, available: float, remaining: float}
     */
    public function toSummary(): array
    {
        return [
            'id' => $this->id,
            'year' => $this->year,
            'entitled' => $this->entitled_days,
            'carried_over' => $this->carried_over_days,
            'used' => $this->used_days,
            'pending' => $this->pending_days,
            'total' => $this->total(),
            'available' => $this->available(),
            'remaining' => $this->remaining(),
        ];
    }

    /**
     * @param  Builder<LeaveBalance>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('user_id'), User::query()->visibleTo($viewer)->select('id'));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<LeaveType, $this>
     */
    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class)->withTrashed();
    }
}
