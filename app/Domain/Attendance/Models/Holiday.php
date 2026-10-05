<?php

namespace App\Domain\Attendance\Models;

use App\Domain\Attendance\Enums\HolidayType;
use App\Models\Company;
use App\Models\Concerns\Auditable;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Factories\HolidayFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * National holiday, collective leave (cuti bersama) or company day off.
 *
 * @property string $id
 * @property string $company_id
 * @property CarbonImmutable $date
 * @property string $name
 * @property HolidayType $type
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Company $company
 */
#[Fillable(['company_id', 'date', 'name', 'type'])]
#[UseFactory(HolidayFactory::class)]
class Holiday extends Model
{
    /** @use HasFactory<HolidayFactory> */
    use Auditable, HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'immutable_date',
            'type' => HolidayType::class,
        ];
    }

    /**
     * @param  Builder<Holiday>  $query
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
}
