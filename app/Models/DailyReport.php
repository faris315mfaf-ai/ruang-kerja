<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\DailyReportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One employee's work progress report for one office date
 * (docs/DATABASE.md §4 daily_reports). Draft until `submitted_at` is set.
 *
 * @property string $id
 * @property string $company_id
 * @property string $user_id
 * @property CarbonImmutable $report_date
 * @property string|null $summary
 * @property string|null $blockers
 * @property string|null $notes
 * @property CarbonImmutable|null $submitted_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $user
 * @property-read Collection<int, DailyReportItem> $items
 */
#[Fillable(['company_id', 'user_id', 'report_date', 'summary', 'blockers', 'notes', 'submitted_at'])]
class DailyReport extends Model
{
    /** @use HasFactory<DailyReportFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'report_date' => 'date',
            'submitted_at' => 'datetime',
        ];
    }

    public function isSubmitted(): bool
    {
        return $this->submitted_at !== null;
    }

    /**
     * @param  Builder<DailyReport>  $query
     */
    public function scopeSubmitted(Builder $query): void
    {
        $query->whereNotNull($this->qualifyColumn('submitted_at'));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return HasMany<DailyReportItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(DailyReportItem::class)->orderBy('position');
    }
}
