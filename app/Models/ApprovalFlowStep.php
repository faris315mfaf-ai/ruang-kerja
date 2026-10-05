<?php

namespace App\Models;

use App\Domain\Requests\Enums\ApproverType;
use Database\Factories\ApprovalFlowStepFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $approval_flow_id
 * @property int $step_order
 * @property ApproverType $approver_type
 * @property string|null $approver_role
 * @property string|null $approver_user_id
 * @property array<string, int|float>|null $condition
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ApprovalFlow $flow
 * @property-read User|null $approverUser
 */
#[Fillable(['approval_flow_id', 'step_order', 'approver_type', 'approver_role', 'approver_user_id', 'condition'])]
class ApprovalFlowStep extends Model
{
    /** @use HasFactory<ApprovalFlowStepFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'step_order' => 'integer',
            'approver_type' => ApproverType::class,
            'condition' => 'array',
        ];
    }

    /**
     * @return BelongsTo<ApprovalFlow, $this>
     */
    public function flow(): BelongsTo
    {
        return $this->belongsTo(ApprovalFlow::class, 'approval_flow_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approverUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }
}
