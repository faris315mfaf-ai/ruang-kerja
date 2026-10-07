<?php

namespace App\Domain\Analytics\Enums;

/**
 * Dashboards of this module (PRD M7). Direksi (keputusan pemilik 6 Okt 2026):
 * daily, weekly and per-project work monitoring, action notes and quick
 * access to every workspace; the portfolio stays at `/portofolio`.
 */
enum DashboardView: string
{
    case Personal = 'saya';
    case Division = 'divisi';
    case Hr = 'hr';
    case Direksi = 'direksi';

    public function label(): string
    {
        return match ($this) {
            self::Personal => 'Saya',
            self::Division => 'Kepala Divisi',
            self::Hr => 'HR',
            self::Direksi => 'Direksi',
        };
    }

    public function path(): string
    {
        return '/dashboard/'.$this->value;
    }
}
