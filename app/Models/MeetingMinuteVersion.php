<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Snapshot of minutes content (SaveMinutes: at most one per author per five
 * minutes, the latest one is refreshed in between; always on finalize).
 *
 * @property string $id
 * @property string $minutes_id
 * @property array<string, mixed> $content
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read MeetingMinutes $minutes
 */
#[Fillable(['minutes_id', 'content', 'created_by'])]
class MeetingMinuteVersion extends Model
{
    use HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['content' => 'array'];
    }

    /**
     * @return BelongsTo<MeetingMinutes, $this>
     */
    public function minutes(): BelongsTo
    {
        return $this->belongsTo(MeetingMinutes::class, 'minutes_id');
    }
}
