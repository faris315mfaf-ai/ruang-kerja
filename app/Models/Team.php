<?php

namespace App\Models;

use Database\Factories\TeamFactory;
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
 * @property string $division_id
 * @property string $name
 * @property string|null $code
 * @property string|null $lead_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Division $division
 * @property-read User|null $lead
 */
#[Fillable(['division_id', 'name', 'code', 'lead_user_id'])]
class Team extends Model
{
    /** @use HasFactory<TeamFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * @return Attribute<string|null, string|null>
     */
    protected function code(): Attribute
    {
        return Attribute::make(set: fn (?string $value): ?string => $value === null || trim($value) === '' ? null : mb_strtoupper(trim($value)));
    }

    /**
     * Teams are visible to every employee of the owning company (org chart).
     *
     * @param  Builder<Team>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereHas('division', fn (Builder $division) => $division->where('company_id', $viewer->company_id));
    }

    /**
     * @return BelongsTo<Division, $this>
     */
    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    /**
     * Ketua Tim.
     *
     * @return BelongsTo<User, $this>
     */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_user_id');
    }

    /**
     * @return HasMany<User, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
