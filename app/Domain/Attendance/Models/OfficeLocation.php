<?php

namespace App\Domain\Attendance\Models;

use App\Models\Company;
use App\Models\Concerns\Auditable;
use App\Models\User;
use Database\Factories\OfficeLocationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Geofence for GPS check-in (docs/DATABASE.md §2).
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property string|null $address
 * @property float $latitude
 * @property float $longitude
 * @property int $radius_m
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Company $company
 */
#[Fillable(['company_id', 'name', 'address', 'latitude', 'longitude', 'radius_m', 'is_active'])]
#[UseFactory(OfficeLocationFactory::class)]
class OfficeLocation extends Model
{
    /** @use HasFactory<OfficeLocationFactory> */
    use Auditable, HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'radius_m' => 100,
        'is_active' => true,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'radius_m' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Every employee may see the company's locations (check-in map).
     *
     * @param  Builder<OfficeLocation>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);
    }

    /**
     * @param  Builder<OfficeLocation>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where($this->qualifyColumn('is_active'), true);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return HasMany<Shift, $this>
     */
    public function shifts(): HasMany
    {
        return $this->hasMany(Shift::class);
    }
}
