<?php

namespace App\Domain\Attendance\Exceptions;

use App\Domain\Attendance\Data\GeofenceMatch;
use App\Domain\Attendance\Enums\AttendanceRejection;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Support\OfficeClock;
use Carbon\CarbonInterface;
use RuntimeException;

/**
 * A business rule refused the check-in/out. Messages follow docs/DESIGN.md §8:
 * say what happened and what to do next.
 */
final class AttendanceException extends RuntimeException
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public readonly AttendanceRejection $reason,
        string $message,
        public readonly array $context = [],
    ) {
        parent::__construct($message);
    }

    public static function consentRequired(): self
    {
        return new self(
            AttendanceRejection::ConsentRequired,
            'Setujui pemakaian data lokasi dan selfie terlebih dulu sebelum check-in.',
            ['version' => config()->string('attendance.consent.version')],
        );
    }

    public static function alreadyCheckedIn(CarbonInterface $at): self
    {
        return new self(
            AttendanceRejection::AlreadyCheckedIn,
            'Anda sudah check-in pukul '.self::time($at).'. Lakukan check-out saat selesai bekerja.',
            ['at' => $at->toIso8601String()],
        );
    }

    public static function alreadyCheckedOut(CarbonInterface $at): self
    {
        return new self(
            AttendanceRejection::AlreadyCheckedOut,
            'Anda sudah check-out pukul '.self::time($at).'. Ajukan koreksi absensi bila jamnya keliru.',
            ['at' => $at->toIso8601String()],
        );
    }

    public static function notCheckedIn(): self
    {
        return new self(
            AttendanceRejection::NotCheckedIn,
            'Anda belum check-in hari ini. Check-in dulu, atau ajukan koreksi absensi bila lupa.',
        );
    }

    public static function tooEarly(CarbonInterface $opensAt, string $shiftName): self
    {
        return new self(
            AttendanceRejection::TooEarly,
            "Check-in untuk shift {$shiftName} baru dibuka pukul ".self::time($opensAt).'.',
            ['opens_at' => $opensAt->toIso8601String()],
        );
    }

    public static function outsideGeofence(GeofenceMatch $match, ?float $accuracyM): self
    {
        $location = $match->location;

        return new self(
            AttendanceRejection::OutsideGeofence,
            "Anda berada {$match->roundedDistance()} m dari {$location->name} (batas {$location->radius_m} m). Ajukan dinas luar jika sedang bertugas di luar.",
            [
                'distance_m' => $match->roundedDistance(),
                'radius_m' => $location->radius_m,
                'accuracy_m' => $accuracyM === null ? null : (int) round($accuracyM),
                'location' => [
                    'id' => $location->id,
                    'name' => $location->name,
                    'latitude' => $location->latitude,
                    'longitude' => $location->longitude,
                    'radius_m' => $location->radius_m,
                ],
            ],
        );
    }

    public static function noOfficeLocation(): self
    {
        return new self(
            AttendanceRejection::NoOfficeLocation,
            'Belum ada lokasi kantor aktif untuk check-in. Hubungi HR untuk mengatur lokasi kantor.',
        );
    }

    public static function noteRequired(): self
    {
        return new self(
            AttendanceRejection::NoteRequired,
            'Tulis catatan lokasi atau aktivitas untuk check-in di luar kantor (WFH/lapangan).',
        );
    }

    public static function dayHasRequest(AttendanceStatus $status): self
    {
        return new self(
            AttendanceRejection::DayHasRequest,
            "Hari ini tercatat {$status->label()} dari pengajuan yang disetujui. Hubungi HR bila Anda tetap masuk kerja.",
            ['status' => $status->value],
        );
    }

    public static function qrInvalid(): self
    {
        return new self(
            AttendanceRejection::QrInvalid,
            'Kode QR tidak dikenali. Pindai kode yang tampil di layar kiosk RuangKerja.',
        );
    }

    public static function qrExpired(): self
    {
        return new self(
            AttendanceRejection::QrExpired,
            'Kode QR sudah kedaluwarsa. Pindai kode terbaru di layar kiosk (berganti tiap 30 detik).',
        );
    }

    /**
     * @param  list<string>  $allowed  names of the locations the employee may use
     */
    public static function qrWrongLocation(string $scanned, array $allowed): self
    {
        $message = $allowed === []
            ? "Kode QR ini untuk {$scanned}, bukan lokasi check-in Anda."
            : "Kode QR ini untuk {$scanned}. Check-in Anda di ".implode(', ', $allowed).'.';

        return new self(AttendanceRejection::QrWrongLocation, $message, ['location' => $scanned]);
    }

    public static function qrLocationRequired(): self
    {
        return new self(
            AttendanceRejection::QrLocationRequired,
            'Check-in dengan kode QR memerlukan lokasi GPS. Aktifkan izin lokasi di peramban lalu pindai kode QR lagi.',
        );
    }

    private static function time(CarbonInterface $at): string
    {
        return OfficeClock::time($at);
    }
}
