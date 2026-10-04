<?php

namespace App\Domain\Organization\Enums;

/**
 * Colour scheme preference stored in users.theme and the `appearance` cookie.
 */
enum Theme: string
{
    case System = 'system';
    case Light = 'light';
    case Dark = 'dark';

    public function label(): string
    {
        return match ($this) {
            self::System => 'Sistem',
            self::Light => 'Terang',
            self::Dark => 'Gelap',
        };
    }

    /**
     * Resolve a raw value (cookie, request input) to a theme, falling back to System.
     */
    public static function fromValue(mixed $value): self
    {
        if ($value instanceof self) {
            return $value;
        }

        return is_string($value) ? (self::tryFrom($value) ?? self::System) : self::System;
    }
}
