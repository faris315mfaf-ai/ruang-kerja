<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Database\Factories\DivisionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $company_id
 * @property string|null $parent_id
 * @property string $name
 * @property string $code
 * @property string|null $head_user_id
 * @property bool $is_board
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Company $company
 * @property-read Division|null $parent
 * @property-read User|null $head
 */
#[Fillable(['company_id', 'parent_id', 'name', 'code', 'head_user_id', 'is_board'])]
class Division extends Model
{
    /** @use HasFactory<DivisionFactory> */
    use Auditable, HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_board' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_board' => 'boolean',
        ];
    }

    /**
     * Codes are stored upper-case (DB check constraint enforces it too).
     *
     * @return Attribute<string, string>
     */
    protected function code(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => mb_strtoupper(trim($value)));
    }

    /**
     * Divisions are visible to every employee of the same company (org chart).
     *
     * @param  Builder<Division>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);
    }

    /**
     * The given division ids plus all of their (non-deleted) sub-divisions.
     *
     * @param  list<string>  $ids
     * @return list<string>
     */
    public static function withDescendantIds(array $ids): array
    {
        $all = array_values(array_unique($ids));
        $frontier = $all;

        // Org trees are shallow; bounded loop guards against corrupted parent cycles.
        for ($depth = 0; $frontier !== [] && $depth < 20; $depth++) {
            /** @var list<string> $children */
            $children = static::query()->whereIn('parent_id', $frontier)->pluck('id')->all();
            $frontier = array_values(array_diff($children, $all));
            $all = [...$all, ...$frontier];
        }

        return $all;
    }

    /**
     * The division id followed by its parent, grandparent, … (closest first).
     *
     * @return list<string>
     */
    public static function withAncestorIds(string $id): array
    {
        $ids = [$id];
        $current = $id;

        // Bounded and cycle-safe, like withDescendantIds().
        for ($depth = 0; $depth < 20; $depth++) {
            $parent = static::query()->whereKey($current)->value('parent_id');

            if (! is_string($parent) || in_array($parent, $ids, true)) {
                break;
            }

            $ids[] = $parent;
            $current = $parent;
        }

        return $ids;
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Division, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Division::class, 'parent_id');
    }

    /**
     * @return HasMany<Division, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Division::class, 'parent_id');
    }

    /**
     * @return HasMany<Team, $this>
     */
    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Kepala Divisi.
     *
     * @return BelongsTo<User, $this>
     */
    public function head(): BelongsTo
    {
        return $this->belongsTo(User::class, 'head_user_id');
    }
}
