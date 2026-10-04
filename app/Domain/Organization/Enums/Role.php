<?php

namespace App\Domain\Organization\Enums;

/**
 * Global roles managed by spatie/laravel-permission (guard `web`).
 */
enum Role: string
{
    case SuperAdmin = 'super_admin';
    case Direksi = 'direksi';
    case Hr = 'hr';
    case KepalaDivisi = 'kepala_divisi';
    case Anggota = 'anggota';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::Direksi => 'Direksi',
            self::Hr => 'HR',
            self::KepalaDivisi => 'Kepala Divisi',
            self::Anggota => 'Anggota',
        };
    }
}
