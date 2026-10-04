<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-user notification settings that are not (event, channel) toggles.
 *
 * @property string $user_id
 * @property string $digest_time "HH:MM:SS" in the office timezone
 * @property bool $quiet_hours
 * @property bool $pause_while_on_leave
 * @property CarbonImmutable|null $digest_last_run_on
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['user_id', 'digest_time', 'quiet_hours', 'pause_while_on_leave', 'digest_last_run_on'])]
class NotificationSetting extends Model
{
    protected $primaryKey = 'user_id';

    protected $keyType = 'string';

    public $incrementing = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quiet_hours' => 'boolean',
            'pause_while_on_leave' => 'boolean',
            'digest_last_run_on' => 'date',
        ];
    }

    /**
     * Stored settings, or an unsaved instance with defaults.
     */
    public static function for(User $user): self
    {
        $setting = self::query()->find($user->id);

        if ($setting instanceof self) {
            return $setting;
        }

        $default = new self;
        $default->forceFill([
            'user_id' => $user->id,
            'digest_time' => self::normalizeTime((string) config('notifications.digest.default_time', '07:30')),
            'quiet_hours' => true,
            'pause_while_on_leave' => false,
        ]);

        return $default;
    }

    /**
     * "07:30" / "07:30:00" → "07:30:00".
     */
    public static function normalizeTime(string $time): string
    {
        return strlen($time) === 5 ? $time.':00' : $time;
    }

    /**
     * Digest time as "HH:MM".
     */
    public function digestTimeShort(): string
    {
        return substr($this->digest_time, 0, 5);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
