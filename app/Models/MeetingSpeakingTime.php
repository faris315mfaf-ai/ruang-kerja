<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A participant's own accumulated speaking time in the video room of one
 * meeting occurrence, reported by their browser (ReportSpeakingTime: never
 * decreases, capped by the time actually spent). docs/DATABASE.md §7
 * meeting_speaking_times.
 *
 * @property string $id
 * @property string $meeting_id
 * @property CarbonImmutable $occurrence_date
 * @property string $user_id
 * @property int $ms_spoken
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Meeting $meeting
 * @property-read User $user
 */
#[Fillable(['meeting_id', 'occurrence_date', 'user_id', 'ms_spoken'])]
class MeetingSpeakingTime extends Model
{
    use HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'ms_spoken' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurrence_date' => 'date',
            'ms_spoken' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Meeting, $this>
     */
    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
