<?php

namespace App\Domain\Attendance\Models;

use App\Domain\Attendance\Enums\ConsentType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Factories\AttendanceConsentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Explicit consent for location/selfie processing (UU PDP), per policy version.
 *
 * @property string $id
 * @property string $user_id
 * @property ConsentType $type
 * @property string $version
 * @property CarbonImmutable $granted_at
 * @property CarbonImmutable|null $revoked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 */
#[Fillable(['user_id', 'type', 'version', 'granted_at', 'revoked_at'])]
#[UseFactory(AttendanceConsentFactory::class)]
class AttendanceConsent extends Model
{
    /** @use HasFactory<AttendanceConsentFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => ConsentType::class,
            'granted_at' => 'immutable_datetime',
            'revoked_at' => 'immutable_datetime',
        ];
    }

    public static function currentVersion(): string
    {
        return config()->string('attendance.consent.version');
    }

    /**
     * Not revoked and given for the current policy version.
     *
     * @param  Builder<AttendanceConsent>  $query
     */
    public function scopeCurrent(Builder $query): void
    {
        $query->where($this->qualifyColumn('version'), self::currentVersion())
            ->whereNull($this->qualifyColumn('revoked_at'));
    }

    /**
     * Whether the user consented to everything a GPS + selfie check-in needs.
     */
    public static function hasCurrentConsent(User $user): bool
    {
        $required = array_map(fn (ConsentType $type): string => $type->value, ConsentType::requiredForCheckIn());

        $granted = self::query()
            ->current()
            ->where('user_id', $user->id)
            ->whereIn('type', $required)
            ->distinct()
            ->count('type');

        return $granted === count($required);
    }

    /**
     * @param  Builder<AttendanceConsent>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('user_id'), $viewer->id);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
