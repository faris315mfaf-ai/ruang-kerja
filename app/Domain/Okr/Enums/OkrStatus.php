<?php

namespace App\Domain\Okr\Enums;

/**
 * Computed status of a key result or objective: progress compared with the
 * share of the quarter that has passed (App\Domain\Analytics\Okr\OkrStatusResolver).
 */
enum OkrStatus: string
{
    case OnTrack = 'on_track';
    case AtRisk = 'at_risk';
    case Behind = 'behind';

    public function label(): string
    {
        return match ($this) {
            self::OnTrack => 'Sesuai jalur',
            self::AtRisk => 'Berisiko',
            self::Behind => 'Tertinggal',
        };
    }

    /**
     * Higher = worse (used to detect a status that dropped).
     */
    public function severity(): int
    {
        return match ($this) {
            self::OnTrack => 0,
            self::AtRisk => 1,
            self::Behind => 2,
        };
    }
}
