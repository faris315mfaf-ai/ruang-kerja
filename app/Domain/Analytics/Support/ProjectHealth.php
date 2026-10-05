<?php

namespace App\Domain\Analytics\Support;

/**
 * Labels of `workspaces.health` (PRD M10, set by the PIC). Kept as plain
 * strings here: the project module (Sprint 9 part B) owns the enum.
 */
final class ProjectHealth
{
    public const array AT_RISK = ['at_risk', 'off_track'];

    public static function label(?string $health): ?string
    {
        return match ($health) {
            'on_track' => 'Sesuai jalur',
            'at_risk' => 'Berisiko',
            'off_track' => 'Bermasalah',
            default => null,
        };
    }
}
