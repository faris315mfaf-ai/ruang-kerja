<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The candidate's answer to an interview question, typed by HR during the
 * interview (one per candidate + question).
 *
 * @property string $id
 * @property string $candidate_id
 * @property string $question_id
 * @property string $answer
 * @property string|null $recorded_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Candidate $candidate
 * @property-read HiringQuestion $question
 */
#[Fillable(['candidate_id', 'question_id', 'answer', 'recorded_by'])]
class InterviewAnswer extends Model
{
    use HasUlids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'recorded_by' => null,
    ];

    /**
     * @return BelongsTo<Candidate, $this>
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * @return BelongsTo<HiringQuestion, $this>
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(HiringQuestion::class, 'question_id');
    }
}
