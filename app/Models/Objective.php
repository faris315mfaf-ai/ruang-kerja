<?php

namespace App\Models;

use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Domain\Organization\Enums\Permission;
use Carbon\CarbonImmutable;
use Database\Factories\ObjectiveFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Division objective for one quarter (docs/DATABASE.md §8, PRD Fase 3 KPI/OKR).
 *
 * @property string $id
 * @property string $company_id
 * @property string $division_id
 * @property string $quarter "2026-Q4"
 * @property string $title
 * @property string|null $description
 * @property string $owner_id
 * @property ObjectiveStatus $status
 * @property CarbonImmutable|null $closed_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Division $division
 * @property-read User $owner
 * @property-read Collection<int, KeyResult> $keyResults
 */
#[Fillable(['company_id', 'division_id', 'quarter', 'title', 'description', 'owner_id', 'status', 'closed_at'])]
class Objective extends Model
{
    /** @use HasFactory<ObjectiveFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'active',
        'description' => null,
        'closed_at' => null,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ObjectiveStatus::class,
            'closed_at' => 'datetime',
        ];
    }

    public function quarterValue(): Quarter
    {
        return Quarter::parse($this->quarter);
    }

    public function isClosed(): bool
    {
        return $this->status === ObjectiveStatus::Closed;
    }

    /**
     * Divisions whose OKR a user reads without a company-wide permission: their
     * own division and the divisions they lead (with sub-divisions).
     *
     * @return list<string>
     */
    public static function divisionScopeFor(User $viewer): array
    {
        $ids = $viewer->ledDivisionIds();

        if ($viewer->division_id !== null) {
            $ids[] = $viewer->division_id;
        }

        return array_values(array_unique($ids));
    }

    /**
     * Same rule as ObjectivePolicy::view: company-wide readers (Direksi, HR,
     * Super Admin = dashboard.view_company), the division's employees and
     * heads, and the owners of the objective or one of its key results.
     * Inactive users see nothing.
     *
     * @param  Builder<Objective>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);

        if (! $viewer->isActive()) {
            $query->whereRaw('false');

            return;
        }

        if ($viewer->hasPermission(Permission::DashboardViewCompany)) {
            return;
        }

        $divisionIds = self::divisionScopeFor($viewer);

        $query->where(function (Builder $scope) use ($viewer, $divisionIds): void {
            $scope->where($this->qualifyColumn('owner_id'), $viewer->id)
                ->orWhereExists(function (QueryBuilder $kr) use ($viewer): void {
                    $kr->selectRaw('1')
                        ->from('key_results')
                        ->whereColumn('key_results.objective_id', $this->qualifyColumn('id'))
                        ->where('key_results.owner_id', $viewer->id);
                });

            if ($divisionIds !== []) {
                $scope->orWhereIn($this->qualifyColumn('division_id'), $divisionIds);
            }
        });
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
    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class)->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return HasMany<KeyResult, $this>
     */
    public function keyResults(): HasMany
    {
        // chaperone(): each key result gets this objective as its `objective`
        // relation (policies read it) without extra queries.
        return $this->hasMany(KeyResult::class)->chaperone()->orderBy('position')->orderBy('id');
    }
}
