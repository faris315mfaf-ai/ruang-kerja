<?php

namespace App\Domain\Attendance\Enums;

/**
 * How a check-in/out was recorded (attendance_logs.method).
 */
enum AttendanceMethod: string
{
    case GpsSelfie = 'gps_selfie';
    case Qr = 'qr';
    case Wfh = 'wfh';
    case Manual = 'manual';
    case Face = 'face';
    case Fingerprint = 'fingerprint';

    public function label(): string
    {
        return match ($this) {
            self::GpsSelfie => 'GPS + selfie',
            self::Qr => 'QR kiosk',
            self::Wfh => 'WFH / lapangan',
            self::Manual => 'Manual oleh HR',
            self::Face => 'Pengenalan wajah',
            self::Fingerprint => 'Sidik jari',
        };
    }
}
