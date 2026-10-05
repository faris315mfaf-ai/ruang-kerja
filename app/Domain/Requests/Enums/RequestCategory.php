<?php

namespace App\Domain\Requests\Enums;

/**
 * Kind of request (leave_types.category). Decides the form fields, how the
 * duration is computed and which attendance effect an approval has.
 */
enum RequestCategory: string
{
    case Leave = 'leave';
    case Permit = 'permit';
    case Sick = 'sick';
    case Overtime = 'overtime';
    case Correction = 'correction';
    case BusinessTrip = 'business_trip';

    public function label(): string
    {
        return match ($this) {
            self::Leave => 'Cuti',
            self::Permit => 'Izin',
            self::Sick => 'Sakit',
            self::Overtime => 'Lembur',
            self::Correction => 'Koreksi absensi',
            self::BusinessTrip => 'Dinas luar',
        };
    }

    /**
     * Indonesian URL slug (`/pengajuan/baru?kategori=cuti`).
     */
    public function slug(): string
    {
        return match ($this) {
            self::Leave => 'cuti',
            self::Permit => 'izin',
            self::Sick => 'sakit',
            self::Overtime => 'lembur',
            self::Correction => 'koreksi',
            self::BusinessTrip => 'dinas',
        };
    }

    public static function fromSlug(?string $slug): ?self
    {
        foreach (self::cases() as $case) {
            if ($case->slug() === $slug || $case->value === $slug) {
                return $case;
            }
        }

        return null;
    }

    /**
     * Requests that mean "not at work" on whole days; they clash with each other.
     */
    public function isAbsence(): bool
    {
        return in_array($this, [self::Leave, self::Permit, self::Sick, self::BusinessTrip], true);
    }

    /**
     * attendance_days.status written for approved whole-day absences.
     */
    public function attendanceStatus(): ?string
    {
        return match ($this) {
            self::Leave => 'leave',
            self::Permit => 'permit',
            self::Sick => 'sick',
            self::BusinessTrip => 'business_trip',
            self::Overtime, self::Correction => null,
        };
    }

    /**
     * @return list<array{value: string, label: string, slug: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $case): array => ['value' => $case->value, 'label' => $case->label(), 'slug' => $case->slug()],
            self::cases(),
        );
    }
}
