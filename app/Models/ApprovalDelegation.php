<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\ApprovalDelegationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * "Delegasi saat penyetuju cuti": between starts_on and ends_on (office dates)
 * approvals routed to the delegator go to the delegate.
 *
 * @property string $id
 * @property string $delegator_id
 * @property string $delegate_id
 * @property CarbonImmutable $starts_on
 * @property CarbonImmutable $ends_on
 * @property string|null $reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $delegator
 * @property-read User $delegate
 */
#[Fillable(['delegator_id', 'delegate_id', 'starts_on', 'ends_on', 'reason'])]
class ApprovalDelegation extends Model
{
    /** @use HasFactory<ApprovalDelegationFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_on' => 'immutable_date',
            'ends_on' => 'immutable_date',
        ];
    }

    /**
     * Delegations covering the given office date (Y-m-d).
     *
     * @param  Builder<ApprovalDelegation>  $query
     */
    public function scopeActiveOn(Builder $query, string $date): void
    {
        $query->whereDate($this->qualifyColumn('starts_on'), '<=', $date)
            ->whereDate($this->qualifyColumn('ends_on'), '>=', $date);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function delegator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegator_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function delegate(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegate_id');
    }
}
