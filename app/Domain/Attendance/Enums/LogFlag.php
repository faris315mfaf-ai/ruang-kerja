<?php

namespace App\Domain\Attendance\Enums;

/**
 * Basic web fraud signals stored in attendance_logs.flags. They never block a
 * check-in; HR reviews them (docs/PRD.md M2).
 */
enum LogFlag: string
{
    case LowAccuracy = 'low_accuracy';
    case ClockSkew = 'clock_skew';
    case NewDevice = 'new_device';
    case NewIp = 'new_ip';
    case ImpossibleTravel = 'impossible_travel';
    case DarkSelfie = 'dark_selfie';

    public function label(): string
    {
        return match ($this) {
            self::LowAccuracy => 'Akurasi GPS rendah',
            self::ClockSkew => 'Jam perangkat tidak sesuai',
            self::NewDevice => 'Perangkat baru',
            self::NewIp => 'Alamat IP baru',
            self::ImpossibleTravel => 'Perpindahan tidak wajar',
            self::DarkSelfie => 'Selfie gelap atau kosong',
        };
    }

    /**
     * Whether this flag alone marks the log as suspicious. A new IP is only
     * informational: mobile carriers hand out a different IP almost daily.
     */
    public function raisesSuspicion(): bool
    {
        return $this !== self::NewIp;
    }
}
