<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Contracts\WorkingDayCalculator;
use App\Domain\Requests\Data\RequestInput;
use App\Domain\Requests\Data\RequestPeriod;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Turns form input into start/end instants, working days or minutes, per category.
 * Throws ValidationException (Indonesian messages) for impossible periods.
 */
final class RequestDurationCalculator
{
    /** Longest overtime / hourly permit accepted in one request. */
    public const int MAX_MINUTES = 16 * 60;

    public function __construct(private readonly WorkingDayCalculator $calendar) {}

    public function compute(User $user, RequestInput $input): RequestPeriod
    {
        return match ($input->leaveType->category) {
            RequestCategory::Overtime => $this->timeRange($input, true),
            RequestCategory::Correction => $this->correction($user, $input),
            RequestCategory::Permit => $input->startTime !== null || $input->endTime !== null
                ? $this->timeRange($input, false)
                : $this->dayRange($user, $input),
            default => $this->dayRange($user, $input),
        };
    }

    private function dayRange(User $user, RequestInput $input): RequestPeriod
    {
        $type = $input->leaveType;
        $start = $this->date($input->startDate, 'start_date', 'Tanggal mulai wajib diisi.');
        $end = $input->endDate === null ? $start : $this->date($input->endDate, 'end_date', 'Tanggal selesai wajib diisi.');

        if ($end->lt($start)) {
            throw ValidationException::withMessages(['end_date' => 'Tanggal selesai tidak boleh sebelum tanggal mulai.']);
        }

        if ($start->diffInDays($end) > 366) {
            throw ValidationException::withMessages(['end_date' => 'Rentang tanggal terlalu panjang.']);
        }

        if ($type->hasQuota() && $start->year !== $end->year) {
            throw ValidationException::withMessages(['end_date' => 'Saldo dihitung per tahun. Pisahkan pengajuan yang melewati pergantian tahun.']);
        }

        $workDates = $this->calendar->workingDates($user, $start, $end);

        // Calendar-day types (Cuti melahirkan) may start or end on a day off.
        if ($workDates === [] && ! $type->counts_calendar_days) {
            throw ValidationException::withMessages(['start_date' => 'Rentang tanggal tidak berisi hari kerja.']);
        }

        $halfDay = false;

        if ($input->halfDay) {
            if (! $type->allow_half_day) {
                throw ValidationException::withMessages(['half_day' => 'Jenis ini tidak bisa diambil setengah hari.']);
            }

            if (count($workDates) !== 1 || ! $start->equalTo($end)) {
                throw ValidationException::withMessages(['half_day' => 'Setengah hari hanya untuk pengajuan satu hari.']);
            }

            $halfDay = true;
        }

        $days = $halfDay ? 0.5 : (float) ($type->counts_calendar_days ? $start->diffInDays($end) + 1 : count($workDates));

        if ($type->max_days_per_request !== null && $days > $type->max_days_per_request) {
            throw ValidationException::withMessages(['end_date' => sprintf(
                'Maksimal %s %s per pengajuan untuk %s.',
                BalanceLedger::format($type->max_days_per_request),
                $type->dayUnit(),
                mb_strtolower($type->name),
            )]);
        }

        $payload = match ($type->category) {
            RequestCategory::Leave => ['half_day' => $halfDay],
            RequestCategory::Permit => ['mode' => 'days', 'half_day' => $halfDay],
            RequestCategory::BusinessTrip => ['destination' => $input->destination],
            default => [],
        };

        if ($type->category === RequestCategory::BusinessTrip && ($input->destination === null || trim($input->destination) === '')) {
            throw ValidationException::withMessages(['destination' => 'Tujuan dinas wajib diisi.']);
        }

        return new RequestPeriod(
            startAt: OfficeTime::startOfDay($start->toDateString()),
            endAt: OfficeTime::endOfDay($end->toDateString()),
            days: $days,
            minutes: null,
            payload: $payload,
            workDates: $workDates,
        );
    }

    private function timeRange(RequestInput $input, bool $overnight): RequestPeriod
    {
        $date = $this->date($input->date ?? $input->startDate, 'date', 'Tanggal wajib diisi.');
        $startTime = $this->time($input->startTime, 'start_time', 'Jam mulai wajib diisi.');
        $endTime = $this->time($input->endTime, 'end_time', 'Jam selesai wajib diisi.');

        $startAt = OfficeTime::at($date->toDateString(), $startTime);
        $endAt = OfficeTime::at($date->toDateString(), $endTime);

        if ($endAt->lte($startAt)) {
            if (! $overnight) {
                throw ValidationException::withMessages(['end_time' => 'Jam selesai harus setelah jam mulai.']);
            }

            // Overtime past midnight ends the next day.
            $endAt = $endAt->addDay();
        }

        $minutes = (int) $startAt->diffInMinutes($endAt);

        if ($minutes > self::MAX_MINUTES) {
            throw ValidationException::withMessages(['end_time' => 'Durasi maksimal 16 jam per pengajuan.']);
        }

        $payload = [
            'date' => $date->toDateString(),
            'start_time' => $startTime,
            'end_time' => $endTime,
        ];

        if ($input->leaveType->category === RequestCategory::Permit) {
            $payload['mode'] = 'hours';
        }

        return new RequestPeriod($startAt, $endAt, null, $minutes, $payload, []);
    }

    private function correction(User $user, RequestInput $input): RequestPeriod
    {
        $date = $this->date($input->date ?? $input->startDate, 'date', 'Tanggal wajib diisi.');
        $today = OfficeTime::today();

        if ($date->gt($today)) {
            throw ValidationException::withMessages(['date' => 'Koreksi hanya untuk tanggal yang sudah lewat atau hari ini.']);
        }

        $maxBack = $input->leaveType->max_backdate_days;

        if ($maxBack !== null && $date->lt($today->subDays($maxBack))) {
            throw ValidationException::withMessages(['date' => "Koreksi maksimal {$maxBack} hari ke belakang."]);
        }

        $checkIn = $input->checkIn === null ? null : $this->time($input->checkIn, 'check_in', '');
        $checkOut = $input->checkOut === null ? null : $this->time($input->checkOut, 'check_out', '');

        if ($checkIn === null && $checkOut === null) {
            throw ValidationException::withMessages(['check_in' => 'Isi jam masuk dan/atau jam pulang yang benar.']);
        }

        if ($checkIn !== null && $checkOut !== null && $checkOut <= $checkIn) {
            // Night shift: check-out on the next morning (applied as date + 1 day).
            if ($checkOut === $checkIn || ! $this->calendar->crossesMidnight($user, $date)) {
                throw ValidationException::withMessages(['check_out' => 'Jam pulang harus setelah jam masuk (lintas tengah malam hanya untuk shift malam).']);
            }

            $span = OfficeTime::at($date->toDateString(), $checkIn)->diffInMinutes(OfficeTime::at($date->addDay()->toDateString(), $checkOut));

            if ($span > self::MAX_MINUTES) {
                throw ValidationException::withMessages(['check_out' => 'Jam kerja lintas tengah malam maksimal 16 jam.']);
            }
        }

        return new RequestPeriod(
            startAt: OfficeTime::startOfDay($date->toDateString()),
            endAt: OfficeTime::endOfDay($date->toDateString()),
            days: null,
            minutes: null,
            payload: ['date' => $date->toDateString(), 'check_in' => $checkIn, 'check_out' => $checkOut],
            workDates: [],
        );
    }

    private function date(?string $value, string $field, string $message): CarbonImmutable
    {
        if ($value === null || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            throw ValidationException::withMessages([$field => $message]);
        }

        $date = CarbonImmutable::createFromFormat('!Y-m-d', $value, OfficeTime::zone());

        if (! $date instanceof CarbonImmutable || $date->toDateString() !== $value) {
            throw ValidationException::withMessages([$field => 'Tanggal tidak valid.']);
        }

        return $date;
    }

    private function time(?string $value, string $field, string $message): string
    {
        if ($value === null || preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', substr($value, 0, 5)) !== 1) {
            throw ValidationException::withMessages([$field => $message !== '' ? $message : 'Format jam tidak valid.']);
        }

        return substr($value, 0, 5);
    }
}
