<?php

namespace App\Models;

use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Models\Concerns\Auditable;
use Database\Factories\PositionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
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
 * @property string $name
 * @property int $level 1 = Direksi … 5 = Staf
 * @property DashboardRole|null $dashboard_role job dashboard (/peran/{role}), set by HR
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Company $company
 */
#[Fillable(['company_id', 'name', 'level', 'dashboard_role'])]
class Position extends Model
{
    /** @use HasFactory<PositionFactory> */
    use Auditable, HasFactory, HasUlids, SoftDeletes;

    public const int LEVEL_BOARD = 1;

    public const int LEVEL_STAFF = 5;

    /** @var array<string, mixed> */
    protected $attributes = [
        'level' => self::LEVEL_STAFF,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'dashboard_role' => DashboardRole::class,
        ];
    }

    /**
     * @param  Builder<Position>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
