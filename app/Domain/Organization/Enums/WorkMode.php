<?php

namespace App\Domain\Organization\Enums;

/**
 * Where an employee normally works (users.work_mode). Drives geofence rules in attendance.
 */
enum WorkMode: string
{
    case Office = 'office';
    case Hybrid = 'hybrid';
    case Wfh = 'wfh';
    case Field = 'field';

    public function label(): string
    {
        return match ($this) {
            self::Office => 'Kantor',
            self::Hybrid => 'Hybrid',
            self::Wfh => 'WFH',
            self::Field => 'Lapangan',
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
