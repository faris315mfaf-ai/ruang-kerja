<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One session of a person in the video room of a meeting occurrence, written
 * from LiveKit webhooks (App\Domain\Meetings\Actions\RecordVideoEvent). A
 * person who drops and rejoins has several rows; `left_at` null = still in
 * the room. docs/DATABASE.md §7 meeting_attendances.
 *
 * @property string $id
 * @property string $meeting_id
 * @property CarbonImmutable $occurrence_date
 * @property string|null $user_id
 * @property string|null $participant_id
 * @property string|null $guest_name
 * @property string $room
 * @property string $participant_sid
 * @property CarbonImmutable $joined_at
 * @property CarbonImmutable|null $left_at
 * @property int|null $duration_seconds
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Meeting $meeting
 * @property-read User|null $user
 */
#[Fillable(['meeting_id', 'occurrence_date', 'user_id', 'participant_id', 'guest_name', 'room', 'participant_sid', 'joined_at', 'left_at', 'duration_seconds'])]
class MeetingAttendance extends Model
{
    use HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurrence_date' => 'date',
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
            'duration_seconds' => 'integer',
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
