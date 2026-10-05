<?php

namespace App\Domain\Attendance\Models;

use App\Domain\Attendance\Casts\PostgresIntArray;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Concerns\Auditable;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Factories\ShiftAssignmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Either a weekly pattern (weekdays + validity period) or a single-date
 * override (override_date; shift_id null = day off). docs/DATABASE.md §2.
 *
 * @property string $id
 * @property string $user_id
 * @property string|null $shift_id
 * @property list<int> $weekdays ISO weekdays, 1 = Monday … 7 = Sunday
 * @property CarbonImmutable $valid_from
 * @property CarbonImmutable|null $valid_until
 * @property CarbonImmutable|null $override_date
 * @property WorkMode|null $work_mode_override
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read Shift|null $shift
 */
#[Fillable(['user_id', 'shift_id', 'weekdays', 'valid_from', 'valid_until', 'override_date', 'work_mode_override'])]
#[UseFactory(ShiftAssignmentFactory::class)]
class ShiftAssignment extends Model
{
    /** @use HasFactory<ShiftAssignmentFactory> */
    use Auditable, HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'weekdays' => '{}',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'weekdays' => PostgresIntArray::class,
            'valid_from' => 'immutable_date',
            'valid_until' => 'immutable_date',
            'override_date' => 'immutable_date',
            'work_mode_override' => WorkMode::class,
        ];
    }

    public function isOverride(): bool
    {
        return $this->override_date !== null;
    }

    /**
     * Weekly patterns active on the given date (any weekday).
     *
     * @param  Builder<ShiftAssignment>  $query
     */
    public function scopePatternsActiveOn(Builder $query, CarbonImmutable $date): void
    {
        $day = $date->toDateString();

        $query->whereNull($this->qualifyColumn('override_date'))
            ->where($this->qualifyColumn('valid_from'), '<=', $day)
            ->where(function (Builder $period) use ($day): void {
                $period->whereNull($this->qualifyColumn('valid_until'))
                    ->orWhere($this->qualifyColumn('valid_until'), '>=', $day);
            });
    }

    /**
     * Assignments of users the viewer may see (HR manages everyone in the company).
     *
     * @param  Builder<ShiftAssignment>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('user_id'), User::query()->visibleTo($viewer)->select('users.id'));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Shift, $this>
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class)->withTrashed();
    }
}
