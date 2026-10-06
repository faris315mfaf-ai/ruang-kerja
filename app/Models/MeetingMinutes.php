<?php

namespace App\Models;

use App\Domain\Meetings\Enums\MinutesStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Minutes of one meeting occurrence (`meeting_id` + `occurrence_date`).
 * Structured (attendance, notes per agenda item, decisions) with follow-ups
 * in meeting_action_items and snapshots in meeting_minute_versions. Access
 * follows the meeting (MeetingPolicy); final = locked until reopened.
 *
 * @property string $id
 * @property string $meeting_id
 * @property CarbonImmutable $occurrence_date
 * @property MinutesStatus $status
 * @property list<array{user_id: string, present: bool, reason?: string|null}> $attendance
 * @property list<array{title: string, body: string}> $sections
 * @property list<string> $decisions
 * @property int $version
 * @property string|null $updated_by
 * @property CarbonImmutable|null $finalized_at
 * @property string|null $finalized_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Meeting $meeting
 * @property-read Collection<int, MeetingActionItem> $actionItems
 * @property-read Collection<int, MeetingMinuteVersion> $versions
 */
#[Fillable(['meeting_id', 'occurrence_date', 'status', 'attendance', 'sections', 'decisions', 'version', 'updated_by', 'finalized_at', 'finalized_by'])]
class MeetingMinutes extends Model
{
    use HasUlids;

    protected $table = 'meeting_minutes';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'attendance' => '[]',
        'sections' => '[]',
        'decisions' => '[]',
        'version' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurrence_date' => 'date',
            'status' => MinutesStatus::class,
            'attendance' => 'array',
            'sections' => 'array',
            'decisions' => 'array',
            'version' => 'integer',
            'finalized_at' => 'datetime',
        ];
    }

    public function isFinal(): bool
    {
        return $this->status === MinutesStatus::Final;
    }

    /**
     * Content snapshot stored in meeting_minute_versions (and compared on save).
     *
     * @return array{attendance: list<array{user_id: string, present: bool, reason?: string|null}>, sections: list<array{title: string, body: string}>, decisions: list<string>}
     */
    public function content(): array
    {
        return [
            'attendance' => $this->attendance,
            'sections' => $this->sections,
            'decisions' => $this->decisions,
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
     * @return HasMany<MeetingActionItem, $this>
     */
    public function actionItems(): HasMany
    {
        return $this->hasMany(MeetingActionItem::class, 'minutes_id')->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<MeetingMinuteVersion, $this>
     */
    public function versions(): HasMany
    {
        return $this->hasMany(MeetingMinuteVersion::class, 'minutes_id');
    }
}
