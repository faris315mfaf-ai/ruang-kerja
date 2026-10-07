<?php

namespace App\Domain\Hiring\Enums;

/**
 * Lifecycle of a hiring position. Draft and open positions accept Google Form
 * submissions (draft = HR is still testing the form); closed answers 410.
 */
enum PositionStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draf',
            self::Open => 'Dibuka',
            self::Closed => 'Ditutup',
        };
    }

    public function acceptsApplicants(): bool
    {
        return $this !== self::Closed;
    }
}
