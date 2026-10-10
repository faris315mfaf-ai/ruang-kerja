<?php

namespace App\Domain\Briefings\Enums;

use Carbon\CarbonImmutable;

/**
 * Briefing pagi & sore (keputusan pemilik 9 Okt 2026). Every office day has
 * both periods; notes may only be saved inside the recording window, in
 * config('app.office_timezone').
 */
enum BriefingPeriod: string
{
    case Pagi = 'pagi';
    case Sore = 'sore';

    public function label(): string
    {
        return match ($this) {
            self::Pagi => 'Briefing pagi',
            self::Sore => 'Briefing sore',
        };
    }

    /**
     * Recording window in the office timezone: pagi 08.00–11.00,
     * sore 16.00–18.00 ("JJ:MM").
     */
    public function startsAt(): string
    {
        return match ($this) {
            self::Pagi => '08:00',
            self::Sore => '16:00',
        };
    }

    public function endsAt(): string
    {
        return match ($this) {
            self::Pagi => '11:00',
            self::Sore => '18:00',
        };
    }

    /**
     * Whether $now (any timezone) is inside this period's window on the
     * office date it falls on.
     */
    public function isOpenAt(CarbonImmutable $now): bool
    {
        $now = $now->setTimezone(config()->string('app.office_timezone'));

        return $now->format('H:i') >= $this->startsAt() && $now->format('H:i') <= $this->endsAt();
    }

    /**
     * The period whose window is open at $now, if any (pagi first when the
     * windows never overlap).
     */
    public static function open(CarbonImmutable $now): ?self
    {
        foreach (self::cases() as $period) {
            if ($period->isOpenAt($now)) {
                return $period;
            }
        }

        return null;
    }

    /**
     * @return list<array{value: string, label: string, starts_at: string, ends_at: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $period): array => [
            'value' => $period->value,
            'label' => $period->label(),
            'starts_at' => $period->startsAt(),
            'ends_at' => $period->endsAt(),
        ], self::cases());
    }
}
