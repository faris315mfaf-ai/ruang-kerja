<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Database\Factories\ApprovalFlowFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Ordered approval steps used by one or more leave types.
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property bool $skip_self_approval
 * @property bool $allow_delegation
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Company $company
 * @property-read Collection<int, ApprovalFlowStep> $steps
 * @property-read Collection<int, LeaveType> $leaveTypes
 */
#[Fillable(['company_id', 'name', 'skip_self_approval', 'allow_delegation'])]
class ApprovalFlow extends Model
{
    /** @use HasFactory<ApprovalFlowFactory> */
    use Auditable, HasFactory, HasUlids, SoftDeletes;

    /** Name of the company-wide fallback flow (Atasan langsung → HR). */
    public const string DEFAULT_NAME = 'Default';

    /** @var array<string, mixed> */
    protected $attributes = [
        'skip_self_approval' => true,
        'allow_delegation' => true,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'skip_self_approval' => 'boolean',
            'allow_delegation' => 'boolean',
        ];
    }

    /**
     * @param  Builder<ApprovalFlow>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return HasMany<ApprovalFlowStep, $this>
     */
    public function steps(): HasMany
    {
        return $this->hasMany(ApprovalFlowStep::class)->orderBy('step_order');
    }

    /**
     * @return HasMany<LeaveType, $this>
     */
    public function leaveTypes(): HasMany
    {
        return $this->hasMany(LeaveType::class);
    }
}
