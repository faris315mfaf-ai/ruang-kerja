<?php

namespace App\Domain\Analytics\Enums;

/**
 * Dashboards of this module (PRD M7). The Direksi dashboard is the project
 * portfolio (`/portofolio`, Sprint 9 part B) and is only linked from the picker.
 */
enum DashboardView: string
{
    case Personal = 'saya';
    case Division = 'divisi';
    case Hr = 'hr';

    public function label(): string
    {
        return match ($this) {
            self::Personal => 'Saya',
            self::Division => 'Kepala Divisi',
            self::Hr => 'HR',
        };
    }

    public function path(): string
    {
        return '/dashboard/'.$this->value;
    }
}
