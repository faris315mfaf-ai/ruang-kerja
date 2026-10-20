<?php

namespace App\Domain\Attendance\Models;

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\LogFlag;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Factories\AttendanceLogFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\AsEnumCollection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use LogicException;

/**
 * Immutable check-in/out event (docs/DATABASE.md §2). Only the HR review
 * columns may change after insert, and selfie_path may be cleared by the
 * retention job.
 *
 * @property string $id
 * @property string $user_id
 * @property string $attendance_day_id
 * @property AttendanceLogType $type
 * @property AttendanceMethod $method
 * @property CarbonImmutable $occurred_at
 * @property CarbonImmutable|null $client_time
 * @property float|null $latitude
 * @property float|null $longitude
 * @property float|null $accuracy_m
 * @property string|null $office_location_id
 * @property float|null $distance_m
 * @property string|null $selfie_path
 * @property string|null $qr_token_id
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string|null $device_fingerprint
 * @property Collection<int, LogFlag> $flags
 * @property bool $is_suspicious
 * @property string|null $reviewed_by
 * @property CarbonImmutable|null $reviewed_at
 * @property string|null $corrected_by
 * @property string|null $note
 * @property CarbonImmutable|null $received_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read AttendanceDay $day
 * @property-read OfficeLocation|null $officeLocation
 * @property-read User|null $correctedBy
 */
#[Fillable([
    'user_id', 'attendance_day_id', 'type', 'method', 'occurred_at', 'client_time', 'latitude', 'longitude',
    'accuracy_m', 'office_location_id', 'distance_m', 'selfie_path', 'qr_token_id', 'ip_address', 'user_agent',
    'device_fingerprint', 'flags', 'is_suspicious', 'reviewed_by', 'reviewed_at', 'corrected_by', 'note',
    'received_at',
])]
#[Hidden(['selfie_path', 'device_fingerprint', 'ip_address', 'user_agent'])]
#[UseFactory(AttendanceLogFactory::class)]
class AttendanceLog extends Model
{
    /** @use HasFactory<AttendanceLogFactory> */
    use HasFactory, HasUlids;

    /**
     * Columns HR may still set after the event was recorded.
     */
    private const array MUTABLE = ['reviewed_by', 'reviewed_at', 'updated_at'];

    /** @var array<string, mixed> */
    protected $attributes = [
        'flags' => '[]',
        'is_suspicious' => false,
    ];

    protected static function booted(): void
    {
        static::updating(function (self $log): void {
            $dirty = $log->getDirty();
            $changed = array_diff(array_keys($dirty), self::MUTABLE);

            // Selfie retention (attendance:purge-selfies) may only clear the path.
            if (array_key_exists('selfie_path', $dirty) && $dirty['selfie_path'] === null) {
                $changed = array_diff($changed, ['selfie_path']);
            }

            if ($changed !== []) {
                throw new LogicException('Log absensi tidak dapat diubah: '.implode(', ', $changed).'.');
            }
        });

        static::deleting(function (): never {
            throw new LogicException('Log absensi tidak dapat dihapus.');
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => AttendanceLogType::class,
            'method' => AttendanceMethod::class,
            'occurred_at' => 'immutable_datetime',
            'client_time' => 'immutable_datetime',
            'latitude' => 'float',
            'longitude' => 'float',
            'accuracy_m' => 'float',
            'distance_m' => 'float',
            'flags' => AsEnumCollection::of(LogFlag::class),
            'is_suspicious' => 'boolean',
            'reviewed_at' => 'immutable_datetime',
            'received_at' => 'immutable_datetime',
        ];
    }

    public function hasCoordinates(): bool
    {
        return $this->latitude !== null && $this->longitude !== null;
    }

    /**
     * @param  Builder<AttendanceLog>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('user_id'), AttendanceDay::visibleUserIds($viewer));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<AttendanceDay, $this>
     */
    public function day(): BelongsTo
    {
        return $this->belongsTo(AttendanceDay::class, 'attendance_day_id');
    }

    /**
     * @return BelongsTo<OfficeLocation, $this>
     */
    public function officeLocation(): BelongsTo
    {
        return $this->belongsTo(OfficeLocation::class)->withTrashed();
    }

    /**
     * HR / Super Admin who wrote a manual (method `manual`) log.
     *
     * @return BelongsTo<User, $this>
     */
    public function correctedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'corrected_by');
    }
}
