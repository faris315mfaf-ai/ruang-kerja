<?php

namespace App\Domain\Organization\Enums;

/**
 * Seniority of a position (positions.level): 1 = Direksi … 5 = Staf.
 */
enum PositionLevel: int
{
    case Board = 1;
    case DivisionHead = 2;
    case TeamLead = 3;
    case Specialist = 4;
    case Staff = 5;

    public function label(): string
    {
        return match ($this) {
            self::Board => 'Direksi',
            self::DivisionHead => 'Kepala divisi',
            self::TeamLead => 'Ketua tim / supervisor',
            self::Specialist => 'Spesialis',
            self::Staff => 'Staf',
        };
    }

    /**
     * @return list<array{value: int, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $case): array => ['value' => $case->value, 'label' => $case->label()], self::cases());
    }
}
