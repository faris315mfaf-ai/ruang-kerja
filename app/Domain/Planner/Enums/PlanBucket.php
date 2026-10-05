<?php

namespace App\Domain\Planner\Enums;

/**
 * task_plans.bucket — the lanes of "Ruang saya".
 */
enum PlanBucket: string
{
    case Today = 'today';
    case Week = 'week';
    case Later = 'later';

    public function label(): string
    {
        return match ($this) {
            self::Today => 'Hari ini',
            self::Week => 'Minggu ini',
            self::Later => 'Nanti',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $bucket): string => $bucket->value, self::cases());
    }
}
