<?php

namespace App\Domain\Attendance\Models;

use App\Models\Company;
use App\Models\Concerns\Auditable;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Factories\ShiftFactory;
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
 * Working hours template (docs/DATABASE.md §2). Times are office-local ("08:00:00").
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property string $start_time
 * @property string $end_time
 * @property int $break_minutes
 * @property bool $crosses_midnight
 * @property int $late_tolerance_min
 * @property int $early_leave_tolerance_min
 * @property int $check_in_window_before_min
 * @property string|null $office_location_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Company $company
 * @property-read OfficeLocation|null $officeLocation
 */
#[Fillable([
    'company_id', 'name', 'start_time', 'end_time', 'break_minutes', 'crosses_midnight',
    'late_tolerance_min', 'early_leave_tolerance_min', 'check_in_window_before_min', 'office_location_id',
])]
#[UseFactory(ShiftFactory::class)]
class Shift extends Model
{
    /** @use HasFactory<ShiftFactory> */
    use Auditable, HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'break_minutes' => 60,
        'crosses_midnight' => false,
        'late_tolerance_min' => 10,
        'early_leave_tolerance_min' => 0,
        'check_in_window_before_min' => 120,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'break_minutes' => 'integer',
            'crosses_midnight' => 'boolean',
            'late_tolerance_min' => 'integer',
            'early_leave_tolerance_min' => 'integer',
            'check_in_window_before_min' => 'integer',
        ];
    }

    /**
     * Scheduled start on a work date (office timezone, as an instant).
     */
    public function startOn(CarbonImmutable $workDate): CarbonImmutable
    {
        return self::atTime($workDate, $this->start_time);
    }

    /**
     * Scheduled end; the next calendar day for shifts crossing midnight.
     */
    public function endOn(CarbonImmutable $workDate): CarbonImmutable
    {
        $end = self::atTime($workDate, $this->end_time);

        return $this->crosses_midnight ? $end->addDay() : $end;
    }

    /**
     * "08.00–17.00" (Indonesian time format, docs/DESIGN.md §8).
     */
    public function hoursLabel(): string
    {
        return self::timeLabel($this->start_time).'–'.self::timeLabel($this->end_time);
    }

    public static function timeLabel(string $time): string
    {
        return str_replace(':', '.', substr($time, 0, 5));
    }

    /**
     * Whether a shift with these times runs past midnight (end at or before start).
     */
    public static function timesCrossMidnight(string $start, string $end): bool
    {
        return substr($end, 0, 5) <= substr($start, 0, 5);
    }

    /**
     * @param  Builder<Shift>  $query
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
     * @return BelongsTo<OfficeLocation, $this>
     */
    public function officeLocation(): BelongsTo
    {
        return $this->belongsTo(OfficeLocation::class);
    }

    /**
     * @return HasMany<ShiftAssignment, $this>
     */
    public function assignments(): HasMany
    {
        return $this->hasMany(ShiftAssignment::class);
    }

    /**
     * The work date's calendar day (as written in its own timezone) at the given
     * office-local time.
     */
    private static function atTime(CarbonImmutable $workDate, string $time): CarbonImmutable
    {
        [$hour, $minute] = array_map(intval(...), explode(':', $time));

        return CarbonImmutable::parse($workDate->format('Y-m-d'), config()->string('app.office_timezone'))
            ->setTime($hour, $minute);
    }
}
