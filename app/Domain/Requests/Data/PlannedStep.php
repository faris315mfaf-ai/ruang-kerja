<?php

namespace App\Domain\Requests\Data;

use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Models\User;

/**
 * One resolved step: who decides (or which role), or why it is skipped.
 */
final readonly class PlannedStep
{
    public function __construct(
        public int $stepOrder,
        public ApproverType $type,
        public ?string $role,
        public ApprovalStatus $status,
        public ?User $approver = null,
        public ?User $delegatedFrom = null,
        public ?string $note = null,
    ) {}
}
