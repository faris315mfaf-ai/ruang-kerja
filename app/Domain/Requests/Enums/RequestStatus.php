<?php

namespace App\Domain\Requests\Enums;

enum RequestStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case RevisionRequested = 'revision_requested';
    case Canceled = 'canceled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draf',
            self::Pending => 'Menunggu',
            self::Approved => 'Disetujui',
            self::Rejected => 'Ditolak',
            self::RevisionRequested => 'Perlu revisi',
            self::Canceled => 'Dibatalkan',
        };
    }

    /**
     * The requester may still edit the content (and then submit).
     */
    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::RevisionRequested], true);
    }

    /**
     * The requester may cancel: anything not decided yet.
     */
    public function isCancelable(): bool
    {
        return in_array($this, [self::Draft, self::Pending, self::RevisionRequested], true);
    }

    /**
     * Statuses that occupy the period (overlap check).
     *
     * @return list<self>
     */
    public static function occupying(): array
    {
        return [self::Pending, self::RevisionRequested, self::Approved];
    }

    /**
     * @param  list<self>  $cases
     * @return list<string>
     */
    public static function values(array $cases): array
    {
        return array_map(fn (self $case): string => $case->value, $cases);
    }
}
