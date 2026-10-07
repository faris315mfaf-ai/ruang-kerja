<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Someone the organizer removed from the video room of one occurrence: no
 * new LiveKit token for that occurrence until the organizer re-admits them
 * (audit R-04; RemoveVideoParticipant, ReadmitVideoParticipant).
 * docs/DATABASE.md §7 meeting_video_removals.
 *
 * @property string $id
 * @property string $meeting_id
 * @property CarbonImmutable $occurrence_date
 * @property string $user_id
 * @property string|null $removed_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['meeting_id', 'occurrence_date', 'user_id', 'removed_by'])]
class MeetingVideoRemoval extends Model
{
    use HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['occurrence_date' => 'date'];
    }
}
