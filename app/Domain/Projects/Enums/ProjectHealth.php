<?php

namespace App\Domain\Projects\Enums;

/**
 * Health set by the PIC in a project update (never computed).
 */
enum ProjectHealth: string
{
    case OnTrack = 'on_track';
    case AtRisk = 'at_risk';
    case OffTrack = 'off_track';

    public function label(): string
    {
        return match ($this) {
            self::OnTrack => 'Sesuai jalur',
            self::AtRisk => 'Berisiko',
            self::OffTrack => 'Bermasalah',
        };
    }

    /**
     * Sort order on the portfolio: problems first.
     */
    public function rank(): int
    {
        return match ($this) {
            self::OffTrack => 0,
            self::AtRisk => 1,
            self::OnTrack => 2,
        };
    }
}
