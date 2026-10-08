<?php

namespace App\Models;

use App\Domain\Briefings\Enums\BriefingPeriod;
use App\Domain\Notifications\Support\IndonesianDate;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Minutes of one briefing (pagi / sore) of one office date
 * (docs/DATABASE.md §6 briefings). One row per company + date + period —
 * SaveBriefing upserts on that key and notifies the company only on the
 * first save.
 *
 * @property string $id
 * @property string $company_id
 * @property BriefingPeriod $period
 * @property CarbonImmutable $briefing_date
 * @property string $content
 * @property string $created_by
 * @property string|null $delegated_from
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $creator
 * @property-read User|null $delegator
 */
#[Fillable(['company_id', 'period', 'briefing_date', 'content', 'created_by', 'delegated_from'])]
class Briefing extends Model
{
    use HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period' => BriefingPeriod::class,
            'briefing_date' => 'date',
        ];
    }

    /**
     * Notification subject line: "Briefing pagi 9 Oktober 2026".
     */
    public function title(): string
    {
        return $this->period->label().' '.IndonesianDate::dayMonthYear($this->briefing_date);
    }

    /**
     * @param  Builder<Briefing>  $query
     */
    public function scopeForCompanyDate(Builder $query, string $companyId, string $briefingDate): void
    {
        $query->where('company_id', $companyId)->whereDate('briefing_date', $briefingDate);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The HR / Super Admin who delegated the note-taking (null when the
     * recorder saved it personally).
     *
     * @return BelongsTo<User, $this>
     */
    public function delegator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegated_from');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
