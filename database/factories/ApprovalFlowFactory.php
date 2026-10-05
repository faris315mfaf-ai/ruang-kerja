<?php

namespace Database\Factories;

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\ApproverType;
use App\Models\ApprovalFlow;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApprovalFlow>
 */
class ApprovalFlowFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'name' => 'Alur '.fake()->unique()->word(),
            'skip_self_approval' => true,
            'allow_delegation' => true,
        ];
    }

    /**
     * Steps as [type, role|user|null, condition|null] tuples, in order.
     *
     * @param  list<array{0: ApproverType, 1?: Role|User|null, 2?: array<string, int|float>|null}>  $steps
     */
    public function withSteps(array $steps): static
    {
        return $this->afterCreating(function (ApprovalFlow $flow) use ($steps): void {
            foreach ($steps as $index => $step) {
                $target = $step[1] ?? null;

                $flow->steps()->create([
                    'step_order' => $index + 1,
                    'approver_type' => $step[0],
                    'approver_role' => $target instanceof Role ? $target->value : null,
                    'approver_user_id' => $target instanceof User ? $target->id : null,
                    'condition' => $step[2] ?? null,
                ]);
            }
        });
    }

    /**
     * Atasan langsung → HR (the default flow).
     */
    public function managerThenHr(): static
    {
        return $this->withSteps([
            [ApproverType::DirectManager],
            [ApproverType::Role, Role::Hr],
        ]);
    }
}
