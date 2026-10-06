<?php

namespace App\Models;

use App\Domain\Hiring\Enums\ReviewerRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One checklist item of a candidate. `reviewer_id` null = HR item (any HR
 * ticks it); otherwise only that interviewer / approver ticks it.
 *
 * @property string $id
 * @property string $candidate_id
 * @property string|null $reviewer_id
 * @property ReviewerRole $role
 * @property string $label
 * @property bool $is_required
 * @property int $position
 * @property CarbonImmutable|null $checked_at
 * @property string|null $checked_by
 * @property string|null $note
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Candidate $candidate
 * @property-read User|null $reviewer
 * @property-read User|null $checker
 */
#[Fillable(['candidate_id', 'reviewer_id', 'role', 'label', 'is_required', 'position', 'checked_at', 'checked_by', 'note', 'created_by'])]
class CandidateChecklistItem extends Model
{
    use HasUlids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'reviewer_id' => null,
        'is_required' => true,
        'position' => 0,
        'checked_at' => null,
        'checked_by' => null,
        'note' => null,
        'created_by' => null,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => ReviewerRole::class,
            'is_required' => 'boolean',
            'position' => 'integer',
            'checked_at' => 'datetime',
        ];
    }

    public function isChecked(): bool
    {
        return $this->checked_at !== null;
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
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }
}
