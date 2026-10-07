<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * One person's "Jangan transkrip suara saya" choice for a meeting (the whole
 * series). Absent row = not opted out. docs/DATABASE.md §7.
 *
 * @property string $id
 * @property string $meeting_id
 * @property string $user_id
 * @property bool $opted_out
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['meeting_id', 'user_id', 'opted_out'])]
class MeetingTranscriptConsent extends Model
{
    use HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['opted_out' => 'boolean'];
    }
}
