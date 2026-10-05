<?php

namespace App\Domain\Requests\Data;

use App\Domain\Requests\Enums\ApproverType;
use App\Models\ApprovalFlowStep;

/**
 * Flow step definition, independent of the persisted flow (also used for the
 * built-in fallback flow and the fallback step).
 */
final readonly class StepDefinition
{
    /**
     * @param  array<string, int|float>|null  $condition
     */
    public function __construct(
        public ApproverType $type,
        public ?string $role = null,
        public ?string $userId = null,
        public ?array $condition = null,
    ) {}

    public static function fromModel(ApprovalFlowStep $step): self
    {
        return new self($step->approver_type, $step->approver_role, $step->approver_user_id, $step->condition ?: null);
    }
}
