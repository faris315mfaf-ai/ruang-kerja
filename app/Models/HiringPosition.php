<?php

namespace App\Models;

use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Services\HiringAccess;
use Carbon\CarbonImmutable;
use Database\Factories\HiringPositionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A hiring position ("lowongan"). Visible to HR & Super Admin, and to the
 * people HR assigned as interviewer or final approver.
 *
 * @property string $id
 * @property string $company_id
 * @property string $title
 * @property string|null $division_id
 * @property string|null $description
 * @property PositionStatus $status
 * @property CarbonImmutable|null $opened_at
 * @property CarbonImmutable|null $closed_at
 * @property string $webhook_token
 * @property string $webhook_secret
 * @property list<string> $interviewer_ids
 * @property list<string> $final_approver_ids
 * @property array<string, string> $field_map
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Division|null $division
 * @property-read Collection<int, HiringQuestion> $questions
 * @property-read Collection<int, Candidate> $candidates
 */
#[Fillable([
    'company_id', 'title', 'division_id', 'description', 'status', 'opened_at', 'closed_at',
    'webhook_token', 'webhook_secret', 'interviewer_ids', 'final_approver_ids', 'field_map', 'created_by',
])]
#[Hidden(['webhook_secret'])]
class HiringPosition extends Model
{
    /** @use HasFactory<HiringPositionFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'draft',
        'division_id' => null,
        'description' => null,
        'opened_at' => null,
        'closed_at' => null,
        'interviewer_ids' => '[]',
        'final_approver_ids' => '[]',
        'field_map' => '{}',
        'created_by' => null,
        'deleted_at' => null,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => PositionStatus::class,
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'webhook_secret' => 'encrypted',
            'interviewer_ids' => 'array',
            'final_approver_ids' => 'array',
            'field_map' => 'array',
        ];
    }

    /**
     * Positions the viewer may see: every position of the company for HR &
     * Super Admin, otherwise the ones they interview for or decide on.
     *
     * @param  Builder<HiringPosition>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);

        if (app(HiringAccess::class)->isManager($viewer)) {
            return;
        }

        $query->where(function (Builder $scope) use ($viewer): void {
            $scope->whereJsonContains($this->qualifyColumn('interviewer_ids'), $viewer->id)
                ->orWhereJsonContains($this->qualifyColumn('final_approver_ids'), $viewer->id);
        });
    }

    public function isInterviewer(User $user): bool
    {
        return in_array($user->id, $this->interviewer_ids, true);
    }

    public function isApprover(User $user): bool
    {
        return in_array($user->id, $this->final_approver_ids, true);
    }

    public function isReviewer(User $user): bool
    {
        return $this->isInterviewer($user) || $this->isApprover($user);
    }

    public function webhookUrl(): string
    {
        return url('/api/hiring/form/'.$this->webhook_token);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Division, $this>
     */
    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    /**
     * @return HasMany<HiringQuestion, $this>
     */
    public function questions(): HasMany
    {
        return $this->hasMany(HiringQuestion::class, 'position_id')->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<Candidate, $this>
     */
    public function candidates(): HasMany
    {
        return $this->hasMany(Candidate::class, 'position_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
