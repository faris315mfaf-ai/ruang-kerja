<?php

namespace App\Domain\Requests\Enums;

enum ApproverType: string
{
    case DirectManager = 'direct_manager';
    case DivisionHead = 'division_head';
    case Role = 'role';
    case User = 'user';

    public function label(): string
    {
        return match ($this) {
            self::DirectManager => 'Atasan langsung',
            self::DivisionHead => 'Kepala divisi',
            self::Role => 'Peran',
            self::User => 'Orang tertentu',
        };
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $case): array => ['value' => $case->value, 'label' => $case->label()], self::cases());
    }
}
