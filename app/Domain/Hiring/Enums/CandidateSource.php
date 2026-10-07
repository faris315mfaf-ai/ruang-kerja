<?php

namespace App\Domain\Hiring\Enums;

enum CandidateSource: string
{
    case GoogleForm = 'google_form';
    case Manual = 'manual';

    public function label(): string
    {
        return match ($this) {
            self::GoogleForm => 'Google Form',
            self::Manual => 'Ditambahkan manual',
        };
    }
}
