<?php

namespace App\Domain\Automation\Enums;

/**
 * Role targets of a "beri tahu" action (`{kind: 'role', role}`):
 *
 * - kepala_divisi: head of the workspace's division and of the assignees' divisions;
 * - hr / direksi: holders of that global role;
 * - anggota: every member of the workspace.
 *
 * Recipients are always narrowed to people who can see the task.
 */
enum NotifyRole: string
{
    case KepalaDivisi = 'kepala_divisi';
    case Hr = 'hr';
    case Direksi = 'direksi';
    case Anggota = 'anggota';

    public function label(): string
    {
        return match ($this) {
            self::KepalaDivisi => 'Kepala Divisi',
            self::Hr => 'HR',
            self::Direksi => 'Direksi',
            self::Anggota => 'semua anggota workspace',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $case): string => $case->value, self::cases());
    }
}
