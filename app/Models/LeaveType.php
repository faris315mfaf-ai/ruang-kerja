<?php

namespace App\Models;

use App\Domain\Requests\Enums\RequestCategory;
use App\Models\Concerns\Auditable;
use Carbon\CarbonInterface;
use Database\Factories\LeaveTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Jenis pengajuan (Cuti tahunan, Izin, Sakit, Lembur, …).
 *
 * @property string $id
 * @property string $company_id
 * @property string $code
 * @property string $name
 * @property RequestCategory $category
 * @property string|null $description
 * @property float|null $annual_quota_days
 * @property int|null $requires_attachment_after_days
 * @property bool $is_paid
 * @property bool $allow_half_day
 * @property float|null $carry_over_max_days
 * @property int|null $max_backdate_days
 * @property int|null $min_service_months
 * @property string|null $approval_flow_id
 * @property bool $is_active
 * @property int $sort_order
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 * @property-read Company $company
 * @property-read ApprovalFlow|null $approvalFlow
 */
#[Fillable([
    'company_id', 'code', 'name', 'category', 'description', 'annual_quota_days',
    'requires_attachment_after_days', 'is_paid', 'allow_half_day', 'carry_over_max_days',
    'max_backdate_days', 'min_service_months', 'approval_flow_id', 'is_active', 'sort_order',
])]
class LeaveType extends Model
{
    /** @use HasFactory<LeaveTypeFactory> */
    use Auditable, HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_paid' => true,
        'allow_half_day' => false,
        'is_active' => true,
        'sort_order' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category' => RequestCategory::class,
            'annual_quota_days' => 'float',
            'carry_over_max_days' => 'float',
            'requires_attachment_after_days' => 'integer',
            'max_backdate_days' => 'integer',
            'min_service_months' => 'integer',
            'is_paid' => 'boolean',
            'allow_half_day' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return Attribute<string, string>
     */
    protected function code(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => mb_strtoupper(trim($value)));
    }

    /**
     * Whether requests of this type consume a yearly balance.
     */
    public function hasQuota(): bool
    {
        return $this->annual_quota_days !== null;
    }

    /**
     * Attachment is mandatory for a request of $days working days.
     */
    public function requiresAttachmentFor(float $days): bool
    {
        return $this->requires_attachment_after_days !== null && $days > $this->requires_attachment_after_days;
    }

    /**
     * Length-of-service eligibility (Cuti besar: "Belum berhak").
     */
    public function isEligible(User $user, ?CarbonInterface $on = null): bool
    {
        if ($this->min_service_months === null) {
            return true;
        }

        if ($user->joined_at === null) {
            return false;
        }

        return $user->joined_at->diffInMonths($on ?? now()) >= $this->min_service_months;
    }

    /**
     * @param  Builder<LeaveType>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('company_id'), $viewer->company_id);
    }

    /**
     * @param  Builder<LeaveType>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where($this->qualifyColumn('is_active'), true);
    }

    /**
     * @param  Builder<LeaveType>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy($this->qualifyColumn('sort_order'))->orderBy($this->qualifyColumn('name'));
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<ApprovalFlow, $this>
     */
    public function approvalFlow(): BelongsTo
    {
        return $this->belongsTo(ApprovalFlow::class);
    }

    /**
     * @return HasMany<LeaveBalance, $this>
     */
    public function balances(): HasMany
    {
        return $this->hasMany(LeaveBalance::class);
    }
}
