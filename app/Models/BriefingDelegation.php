<?php

namespace App\Models;

use App\Domain\Briefings\Enums\BriefingPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One employee appointed by HR / Super Admin to take the briefing notes of a
 * single date + period, as if they were the recorder
 * (docs/DATABASE.md §6 briefing_delegations). Unique per company + date +
 * period: delegating again replaces the target.
 *
 * @property string $id
 * @property string $company_id
 * @property CarbonImmutable $briefing_date
 * @property BriefingPeriod $period
 * @property string $delegated_to
 * @property string $delegated_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $delegate
 * @property-read User $delegator
 */
#[Fillable(['company_id', 'briefing_date', 'period', 'delegated_to', 'delegated_by'])]
class BriefingDelegation extends Model
{
    use HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'briefing_date' => 'date',
            'period' => BriefingPeriod::class,
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function delegate(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegated_to');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function delegator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegated_by');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
