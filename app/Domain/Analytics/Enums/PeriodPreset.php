<?php

namespace App\Domain\Analytics\Enums;

/**
 * Dashboard period filter (PRD M7: "minggu ini, bulan ini, kuartal, kustom").
 * Values are the URL slugs (`?periode=bulan`).
 */
enum PeriodPreset: string
{
    case Week = 'minggu';
    case Month = 'bulan';
    case Quarter = 'kuartal';
    case Custom = 'kustom';

    public function label(): string
    {
        return match ($this) {
            self::Week => 'Minggu ini',
            self::Month => 'Bulan ini',
            self::Quarter => 'Kuartal',
            self::Custom => 'Kustom',
        };
    }

    /** "dari minggu lalu" — used in delta captions. */
    public function previousLabel(): string
    {
        return match ($this) {
            self::Week => 'minggu lalu',
            self::Month => 'bulan lalu',
            self::Quarter => 'kuartal lalu',
            self::Custom => 'periode sebelumnya',
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
