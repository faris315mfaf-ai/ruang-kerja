<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Interview minutes ("notulensi") on a candidate; plain text, edited and
 * deleted by its author only.
 *
 * @property string $id
 * @property string $candidate_id
 * @property string|null $author_id
 * @property string $body
 * @property CarbonImmutable|null $edited_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Candidate $candidate
 * @property-read User|null $author
 */
#[Fillable(['candidate_id', 'author_id', 'body', 'edited_at'])]
class CandidateNote extends Model
{
    use HasUlids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'author_id' => null,
        'edited_at' => null,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'edited_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Candidate, $this>
     */
    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
