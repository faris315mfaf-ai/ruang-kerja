<?php

namespace App\Models;

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use Database\Factories\RequestApprovalFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One step of one request (per revision round).
 *
 * @property string $id
 * @property string $request_id
 * @property int $round
 * @property int $step_order
 * @property ApproverType $approver_type
 * @property string|null $approver_role
 * @property string|null $approver_id
 * @property string|null $delegated_from_id
 * @property ApprovalStatus $status
 * @property string|null $note
 * @property Carbon|null $activated_at
 * @property Carbon|null $decided_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read EmployeeRequest $request
 * @property-read User|null $approver
 * @property-read User|null $delegatedFrom
 */
#[Fillable([
    'request_id', 'round', 'step_order', 'approver_type', 'approver_role', 'approver_id',
    'delegated_from_id', 'status', 'note', 'activated_at', 'decided_at',
])]
class RequestApproval extends Model
{
    /** @use HasFactory<RequestApprovalFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'round' => 'integer',
            'step_order' => 'integer',
            'approver_type' => ApproverType::class,
            'status' => ApprovalStatus::class,
            'activated_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    /**
     * "Atasan langsung", "HR", "Direksi", "Kepala divisi", or the chosen person.
     */
    public function stepLabel(): string
    {
        return match ($this->approver_type) {
            ApproverType::Role => Role::tryFrom((string) $this->approver_role)?->label() ?? ApproverType::Role->label(),
            ApproverType::User => $this->approver->name ?? ApproverType::User->label(),
            default => $this->approver_type->label(),
        };
    }

    /**
     * @return BelongsTo<EmployeeRequest, $this>
     */
    public function request(): BelongsTo
    {
        return $this->belongsTo(EmployeeRequest::class, 'request_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function delegatedFrom(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegated_from_id');
    }
}
