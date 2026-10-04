<?php

namespace App\Domain\Attendance\Enums;

/**
 * Personal data covered by attendance_consents (UU PDP).
 */
enum ConsentType: string
{
    case Location = 'location';
    case Selfie = 'selfie';
    case Face = 'face';

    public function label(): string
    {
        return match ($this) {
            self::Location => 'Lokasi',
            self::Selfie => 'Foto selfie',
            self::Face => 'Data wajah',
        };
    }

    /**
     * Consents required for a GPS + selfie check-in (face is Phase 3).
     *
     * @return list<self>
     */
    public static function requiredForCheckIn(): array
    {
        return [self::Location, self::Selfie];
    }
}
