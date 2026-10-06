<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\HiringQuestionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Interview question HR prepared for a position. Locked (no delete, no
 * lower max score) once an answer or a score refers to it.
 *
 * @property string $id
 * @property string $position_id
 * @property string $prompt
 * @property string|null $guidance
 * @property int $max_score
 * @property int $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read HiringPosition $hiringPosition
 */
#[Fillable(['position_id', 'prompt', 'guidance', 'max_score', 'position'])]
class HiringQuestion extends Model
{
    /** @use HasFactory<HiringQuestionFactory> */
    use HasFactory, HasUlids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'guidance' => null,
        'max_score' => 5,
        'position' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'max_score' => 'integer',
            'position' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<HiringPosition, $this>
     */
    public function hiringPosition(): BelongsTo
    {
        return $this->belongsTo(HiringPosition::class, 'position_id');
    }

    /**
     * @return HasMany<InterviewAnswer, $this>
     */
    public function answers(): HasMany
    {
        return $this->hasMany(InterviewAnswer::class, 'question_id');
    }

    /**
     * @return HasMany<InterviewScore, $this>
     */
    public function scores(): HasMany
    {
        return $this->hasMany(InterviewScore::class, 'question_id');
    }
}
