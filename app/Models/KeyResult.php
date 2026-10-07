<?php

namespace App\Models;

use App\Domain\Okr\Enums\KeyResultUnit;
use Carbon\CarbonImmutable;
use Database\Factories\KeyResultFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Weighted, measurable result of an objective (docs/DATABASE.md §8).
 *
 * @property string $id
 * @property string $objective_id
 * @property string $title
 * @property KeyResultUnit $unit
 * @property string $unit_label
 * @property float $start_value
 * @property float $target_value
 * @property float $current_value
 * @property float $weight 1–100
 * @property string $owner_id
 * @property int $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Objective $objective
 * @property-read User $owner
 * @property-read Collection<int, KeyResultCheckin> $checkins
 * @property-read Collection<int, Task> $tasks
 */
#[Fillable(['objective_id', 'title', 'unit', 'unit_label', 'start_value', 'target_value', 'current_value', 'weight', 'owner_id', 'position'])]
class KeyResult extends Model
{
    /** @use HasFactory<KeyResultFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'unit_label' => '',
        'weight' => 1,
        'position' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'unit' => KeyResultUnit::class,
            'start_value' => 'float',
            'target_value' => 'float',
            'current_value' => 'float',
            'weight' => 'float',
            'position' => 'integer',
        ];
    }

    /**
     * @return array{start: float, target: float, current: float, weight: float}
     */
    public function values(): array
    {
        return [
            'start' => $this->start_value,
            'target' => $this->target_value,
            'current' => $this->current_value,
            'weight' => $this->weight,
        ];
    }

    /**
     * @param  Builder<KeyResult>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('objective_id'), Objective::query()->visibleTo($viewer)->select('id'));
    }

    /**
     * @return BelongsTo<Objective, $this>
     */
    public function objective(): BelongsTo
    {
        return $this->belongsTo(Objective::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return HasMany<KeyResultCheckin, $this>
     */
    public function checkins(): HasMany
    {
        return $this->hasMany(KeyResultCheckin::class);
    }

    /**
     * @return BelongsToMany<Task, $this>
     */
    public function tasks(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'key_result_tasks')->withPivot(['linked_by', 'created_at']);
    }
}
