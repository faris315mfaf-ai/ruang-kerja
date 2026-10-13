<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Data\RequestPeriod;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\LeaveType;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * Batas pengajuan sakit & izin di hari-H (keputusan pemilik 14 Okt 2026).
 *
 * A type with `submit_cutoff_time` (default 12:00 office time for sakit & izin)
 * only accepts a request whose start date is:
 * - in the future: any time;
 * - today: strictly before the cutoff (12:00:00 is already too late);
 * - in the past: never (the day stands as alpha; HR corrects by hand).
 *
 * Multi-day requests are judged by their start date only. Drafts are not
 * checked, only sending. Calendar days: weekends and shifts play no part
 * (a non-working start date is refused by the period calculation anyway).
 */
final class SubmissionCutoff
{
    /**
     * Only these categories can carry a cutoff.
     */
    public static function applies(LeaveType $type): bool
    {
        return in_array($type->category, [RequestCategory::Sick, RequestCategory::Permit], true);
    }

    /**
     * "HH:MM" of the type, or null when it has none.
     */
    public function time(LeaveType $type): ?string
    {
        return self::applies($type) ? $type->submit_cutoff_time : null;
    }

    /**
     * "12.00" (Indonesian clock format) for messages and labels.
     */
    public static function format(string $time): string
    {
        return str_replace(':', '.', substr($time, 0, 5));
    }

    /**
     * Whether today's cutoff has passed (server clock, office time).
     */
    public function closedToday(LeaveType $type, ?CarbonInterface $now = null): bool
    {
        $time = $this->time($type);

        return $time !== null && $this->passed($time, $now);
    }

    /**
     * Client hints for a type: `submit_cutoff_time`, `submit_cutoff_label`, `submit_closed_today`.
     *
     * @return array{submit_cutoff_time: string|null, submit_cutoff_label: string|null, submit_closed_today: bool}
     */
    public function hints(LeaveType $type, ?CarbonInterface $now = null): array
    {
        $time = $this->time($type);

        return [
            'submit_cutoff_time' => $time,
            'submit_cutoff_label' => $time === null ? null : 'Batas pengajuan hari ini pukul '.self::format($time),
            'submit_closed_today' => $time !== null && $this->passed($time, $now),
        ];
    }

    /**
     * Throws a 422 (Indonesian) when sending a request with this period is too late.
     *
     * @param  string|null  $unchangedDate  office date (Y-m-d) of the request being resent after a revision:
     *                                      its original submission was on time, so the same date stays accepted
     */
    public function assertCanSend(LeaveType $type, RequestPeriod $period, ?CarbonInterface $now = null, ?string $unchangedDate = null): void
    {
        $time = $this->time($type);

        if ($time === null) {
            return;
        }

        $date = OfficeTime::date($period->startAt);

        if ($unchangedDate !== null && $unchangedDate === $date) {
            return;
        }

        $today = OfficeTime::local($now ?? CarbonImmutable::now())->toDateString();
        $field = ($period->payload['mode'] ?? null) === 'hours' ? 'date' : 'start_date';
        $kind = mb_strtolower($type->category->label());

        if ($date < $today) {
            throw ValidationException::withMessages([$field => sprintf(
                'Pengajuan %s untuk tanggal yang sudah lewat tidak diterima, hari itu tercatat alpha. Hubungi HR bila perlu dikoreksi.',
                $kind,
            )]);
        }

        if ($date === $today && $this->passed($time, $now)) {
            throw ValidationException::withMessages([$field => sprintf(
                'Batas pengajuan %s untuk hari ini pukul %s sudah lewat. Hari ini tercatat alpha bila Anda tidak absen.',
                $kind,
                self::format($time),
            )]);
        }
    }

    private function passed(string $time, ?CarbonInterface $now): bool
    {
        $local = OfficeTime::local($now ?? CarbonImmutable::now());

        return $local->greaterThanOrEqualTo($local->setTimeFromTimeString($time));
    }
}
