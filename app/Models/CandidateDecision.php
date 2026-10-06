<?php

namespace App\Models;

use App\Domain\Hiring\Enums\DecisionValue;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A final approver's decision on a candidate in "Keputusan akhir" (one per
 * approver). All approve → Diterima; one rejects → Ditolak.
 *
 * @property string $id
 * @property string $candidate_id
 * @property string $approver_id
 * @property DecisionValue $decision
 * @property string|null $note
 * @property CarbonImmutable $decided_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Candidate $candidate
 * @property-read User $approver
 */
#[Fillable(['candidate_id', 'approver_id', 'decision', 'note', 'decided_at'])]
class CandidateDecision extends Model
{
    use HasUlids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'note' => null,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'decision' => DecisionValue::class,
            'decided_at' => 'datetime',
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
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }
}
