<?php

namespace Database\Factories;

use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RequestApproval>
 */
class RequestApprovalFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'request_id' => EmployeeRequest::factory(),
            'round' => 1,
            'step_order' => 1,
            'approver_type' => ApproverType::DirectManager,
            'approver_role' => null,
            'approver_id' => null,
            'status' => ApprovalStatus::Waiting,
            'activated_at' => now(),
        ];
    }
}
