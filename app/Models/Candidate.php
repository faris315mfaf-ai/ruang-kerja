<?php

namespace App\Models;

use App\Domain\Hiring\Enums\CandidateSource;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Services\HiringAccess;
use Carbon\CarbonImmutable;
use Database\Factories\CandidateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * An applicant for a hiring position. Personal data: never written to logs
 * or audit values (only ids and stages are audited).
 *
 * @property string $id
 * @property string $company_id
 * @property string $position_id
 * @property string $full_name
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $cv_url
 * @property list<array{label: string, url: string}> $attachments
 * @property list<array{question: string, answer: string}> $form_answers
 * @property string|null $external_response_id
 * @property CandidateStage $stage
 * @property string|null $rejected_reason
 * @property CandidateSource $source
 * @property CarbonImmutable $applied_at
 * @property CarbonImmutable|null $decided_at
 * @property CarbonImmutable|null $interview_at planned interview (Ruang HR › Jadwal), UTC
 * @property string|null $interview_location
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read HiringPosition $hiringPosition
 * @property-read Collection<int, CandidateChecklistItem> $checklistItems
 * @property-read Collection<int, InterviewAnswer> $answers
 * @property-read Collection<int, InterviewScore> $scores
 * @property-read Collection<int, CandidateNote> $notes
 * @property-read Collection<int, CandidateDecision> $decisions
 */
#[Fillable([
    'company_id', 'position_id', 'full_name', 'email', 'phone', 'cv_url', 'attachments', 'form_answers',
    'external_response_id', 'stage', 'rejected_reason', 'source', 'applied_at', 'decided_at', 'created_by',
    'interview_at', 'interview_location',
])]
class Candidate extends Model
{
    /** @use HasFactory<CandidateFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'email' => null,
        'phone' => null,
        'cv_url' => null,
        'attachments' => '[]',
        'form_answers' => '[]',
        'external_response_id' => null,
        'stage' => 'applied',
        'rejected_reason' => null,
        'source' => 'manual',
        'decided_at' => null,
        'interview_at' => null,
        'interview_location' => null,
        'created_by' => null,
        'deleted_at' => null,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stage' => CandidateStage::class,
            'source' => CandidateSource::class,
            'attachments' => 'array',
            'form_answers' => 'array',
            'applied_at' => 'datetime',
            'decided_at' => 'datetime',
            'interview_at' => 'datetime',
        ];
    }

    /**
     * Candidates the viewer may see (same rule as CandidatePolicy::view).
     *
     * @param  Builder<Candidate>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);

        if (app(HiringAccess::class)->isManager($viewer)) {
            return;
        }

        $query->whereIn($this->qualifyColumn('position_id'), HiringPosition::query()->visibleTo($viewer)->select('hiring_positions.id'));
    }

    /**
     * @return BelongsTo<HiringPosition, $this>
     */
    public function hiringPosition(): BelongsTo
    {
        return $this->belongsTo(HiringPosition::class, 'position_id')->withTrashed();
    }

    /**
     * @return HasMany<CandidateChecklistItem, $this>
     */
    public function checklistItems(): HasMany
    {
        return $this->hasMany(CandidateChecklistItem::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<InterviewAnswer, $this>
     */
    public function answers(): HasMany
    {
        return $this->hasMany(InterviewAnswer::class);
    }

    /**
     * @return HasMany<InterviewScore, $this>
     */
    public function scores(): HasMany
    {
        return $this->hasMany(InterviewScore::class);
    }

    /**
     * @return HasMany<CandidateNote, $this>
     */
    public function notes(): HasMany
    {
        return $this->hasMany(CandidateNote::class)->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return HasMany<CandidateDecision, $this>
     */
    public function decisions(): HasMany
    {
        return $this->hasMany(CandidateDecision::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
