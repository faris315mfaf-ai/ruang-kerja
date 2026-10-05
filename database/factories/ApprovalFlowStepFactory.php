<?php

namespace Database\Factories;

use App\Domain\Requests\Enums\ApproverType;
use App\Models\ApprovalFlow;
use App\Models\ApprovalFlowStep;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApprovalFlowStep>
 */
class ApprovalFlowStepFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'approval_flow_id' => ApprovalFlow::factory(),
            'step_order' => 1,
            'approver_type' => ApproverType::DirectManager,
            'approver_role' => null,
            'approver_user_id' => null,
            'condition' => null,
        ];
    }
}
