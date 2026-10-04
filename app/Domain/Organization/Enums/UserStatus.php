<?php

namespace App\Domain\Organization\Enums;

/**
 * Employment status (users.status). Only active employees may sign in.
 */
enum UserStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Resigned = 'resigned';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Aktif',
            self::Inactive => 'Nonaktif',
            self::Resigned => 'Mengundurkan diri',
        };
    }

    public function canSignIn(): bool
    {
        return $this === self::Active;
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $case): array => ['value' => $case->value, 'label' => $case->label()], self::cases());
    }
}
