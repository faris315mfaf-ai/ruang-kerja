<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Support\OfficeClock;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Company-wide "jam absen" (keputusan pemilik 13 Okt 2026): the time-of-day
 * range in which check-in and check-out are accepted, stored in
 * `companies.settings.attendance_windows`:
 *
 *   {"check_in": {"from": "06:00", "until": "12:00"}, "check_out": {"from": "15:00", "until": "23:59"}}
 *
 * Every bound is optional and independent; an absent key or null bound means
 * "no limit". Times are 24h `HH:MM` in the office timezone and inclusive
 * (`until` 12:00 accepts up to 12:00:59). The windows do not apply to shifts
 * crossing midnight nor to a day opened yesterday (see appliesTo()).
 */
final readonly class AttendanceWindows
{
    public const string KEY = 'attendance_windows';

    public const string BEFORE = 'before';

    public const string AFTER = 'after';

    public function __construct(
        public ?string $checkInFrom = null,
        public ?string $checkInUntil = null,
        public ?string $checkOutFrom = null,
        public ?string $checkOutUntil = null,
    ) {}

    public static function none(): self
    {
        return new self;
    }

    public static function forUser(User $user): self
    {
        $settings = Company::query()->whereKey($user->company_id)->value('settings');

        return self::fromSettings(is_string($settings) ? json_decode($settings, true) : $settings);
    }

    /**
     * Tolerant parse of `companies.settings`: anything malformed counts as "no limit".
     */
    public static function fromSettings(mixed $settings): self
    {
        $windows = is_array($settings) ? ($settings[self::KEY] ?? null) : null;

        if (! is_array($windows)) {
            return self::none();
        }

        $in = is_array($windows['check_in'] ?? null) ? $windows['check_in'] : [];
        $out = is_array($windows['check_out'] ?? null) ? $windows['check_out'] : [];

        return new self(
            self::time($in['from'] ?? null),
            self::time($in['until'] ?? null),
            self::time($out['from'] ?? null),
            self::time($out['until'] ?? null),
        );
    }

    public function isEmpty(): bool
    {
        return $this->checkInFrom === null && $this->checkInUntil === null
            && $this->checkOutFrom === null && $this->checkOutUntil === null;
    }

    /**
     * Shape stored in `companies.settings` (null when no limit at all).
     *
     * @return array{check_in: array{from: string|null, until: string|null}, check_out: array{from: string|null, until: string|null}}|null
     */
    public function toSettings(): ?array
    {
        if ($this->isEmpty()) {
            return null;
        }

        return [
            'check_in' => ['from' => $this->checkInFrom, 'until' => $this->checkInUntil],
            'check_out' => ['from' => $this->checkOutFrom, 'until' => $this->checkOutUntil],
        ];
    }

    /**
     * Props for the apps: a pair is null when both of its bounds are unset.
     *
     * @return array{checkIn: array{from: string|null, until: string|null}|null, checkOut: array{from: string|null, until: string|null}|null}
     */
    public function toProps(): array
    {
        return [
            'checkIn' => $this->checkInFrom === null && $this->checkInUntil === null ? null : ['from' => $this->checkInFrom, 'until' => $this->checkInUntil],
            'checkOut' => $this->checkOutFrom === null && $this->checkOutUntil === null ? null : ['from' => $this->checkOutFrom, 'until' => $this->checkOutUntil],
        ];
    }

    /**
     * Windows govern day shifts only: a shift crossing midnight, and a day
     * opened yesterday (late check-out of an overnight or overtime day), keep
     * their own rules (shift opening window, check-out grace period).
     */
    public function appliesTo(?DaySchedule $schedule): bool
    {
        return $schedule?->shift?->crosses_midnight !== true;
    }

    /**
     * 'before' / 'after' when the instant is outside the check-in window, otherwise null.
     *
     * @return 'before'|'after'|null
     */
    public function checkInPhase(CarbonInterface $now): ?string
    {
        return self::phase($now, $this->checkInFrom, $this->checkInUntil);
    }

    /**
     * @return 'before'|'after'|null
     */
    public function checkOutPhase(CarbonInterface $now): ?string
    {
        return self::phase($now, $this->checkOutFrom, $this->checkOutUntil);
    }

    /**
     * "Absen masuk dibuka pukul 06.00 dan ditutup pukul 12.00."
     */
    public function checkInMessage(): string
    {
        return self::message('Absen masuk', $this->checkInFrom, $this->checkInUntil);
    }

    public function checkOutMessage(): string
    {
        return self::message('Absen pulang', $this->checkOutFrom, $this->checkOutUntil);
    }

    /**
     * The check-in opening time on the office date of $now (UTC instant), when a lower bound is set.
     */
    public function checkInOpensAt(CarbonInterface $now): ?CarbonImmutable
    {
        return $this->checkInFrom === null ? null : self::instant($now, $this->checkInFrom);
    }

    /**
     * @return 'before'|'after'|null
     */
    private static function phase(CarbonInterface $now, ?string $from, ?string $until): ?string
    {
        $time = OfficeClock::local($now)->format('H:i');

        return match (true) {
            $from !== null && $time < $from => self::BEFORE,
            $until !== null && $time > $until => self::AFTER,
            default => null,
        };
    }

    private static function message(string $label, ?string $from, ?string $until): string
    {
        $parts = array_values(array_filter([
            $from === null ? null : 'dibuka pukul '.str_replace(':', '.', $from),
            $until === null ? null : 'ditutup pukul '.str_replace(':', '.', $until),
        ]));

        return $label.' '.implode(' dan ', $parts).'.';
    }

    private static function instant(CarbonInterface $now, string $time): CarbonImmutable
    {
        return OfficeClock::local($now)->setTimeFromTimeString($time)->utc();
    }

    private static function time(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value) === 1 ? $value : null;
    }
}
