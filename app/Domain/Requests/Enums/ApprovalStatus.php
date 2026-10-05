<?php

namespace App\Domain\Requests\Enums;

/**
 * Status of one step (request_approvals.status).
 */
enum ApprovalStatus: string
{
    /** Planned, earlier steps still open. */
    case Queued = 'queued';
    case Waiting = 'waiting';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case RevisionRequested = 'revision_requested';
    case Skipped = 'skipped';

    public function label(): string
    {
        return match ($this) {
            self::Queued => 'Antre',
            self::Waiting => 'Menunggu',
            self::Approved => 'Disetujui',
            self::Rejected => 'Ditolak',
            self::RevisionRequested => 'Minta revisi',
            self::Skipped => 'Dilewati',
        };
    }

    public function isDecision(): bool
    {
        return in_array($this, [self::Approved, self::Rejected, self::RevisionRequested], true);
    }
}
