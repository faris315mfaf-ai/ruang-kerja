<?php

namespace App\Domain\Hiring\Enums;

/**
 * Who a checklist item belongs to: HR (any HR ticks it), the position's
 * interviewers ("tim luar") or its final approvers (one set per person).
 */
enum ReviewerRole: string
{
    case Hr = 'hr';
    case Interviewer = 'interviewer';
    case Approver = 'approver';

    public function label(): string
    {
        return match ($this) {
            self::Hr => 'HR',
            self::Interviewer => 'Pewawancara',
            self::Approver => 'Penyetuju akhir',
        };
    }
}
