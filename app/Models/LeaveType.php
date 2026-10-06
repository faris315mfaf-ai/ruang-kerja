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
 * @property bool $counts_calendar_days duration in calendar days (Cuti melahirkan) instead of working days
 * @property float|null $max_days_per_request
 * @property float|null $carry_over_max_days
 * @property int|null $max_backdate_days
 * @property int|null $min_service_months
 * @property string|null $approval_flow_id
 * @property bool $is_active
 * @property string|null $locked_reason not null = locked: cannot be requested (keputusan pemilik 6 Okt 2026)
 * @property int $sort_order
 * @property bool $is_provisional_default seeded default not yet reviewed by HR ("Bawaan sementara")
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
    'counts_calendar_days', 'max_days_per_request', 'is_provisional_default', 'locked_reason',
])]
class LeaveType extends Model
{
    /** @use HasFactory<LeaveTypeFactory> */
    use Auditable, HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_paid' => true,
        'allow_half_day' => false,
        'counts_calendar_days' => false,
        'is_provisional_default' => false,
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
            'counts_calendar_days' => 'boolean',
            'max_days_per_request' => 'float',
            'is_provisional_default' => 'boolean',
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
     * Default reason of the cuti & lembur lock (keputusan pemilik 6 Okt 2026).
     */
    public const string SOP_LOCK_REASON = 'Dikunci sampai SOP cuti/lembur ditetapkan.';

    /**
     * Locked types stay visible (lock tile in the form) but cannot be drafted
     * or submitted; requests already sent or approved are not affected.
     */
    public function isLocked(): bool
    {
        // Tolerates partial selects that leave the column out.
        return array_key_exists('locked_reason', $this->attributes) && $this->locked_reason !== null;
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
     * "hari kalender" / "hari kerja" (leave) / "hari".
     */
    public function dayUnit(): string
    {
        // Tolerates partial selects (`leaveType:id,name,category`) instead of failing.
        if (array_key_exists('counts_calendar_days', $this->attributes) && $this->counts_calendar_days) {
            return 'hari kalender';
        }

        return $this->category === RequestCategory::Leave ? 'hari kerja' : 'hari';
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
