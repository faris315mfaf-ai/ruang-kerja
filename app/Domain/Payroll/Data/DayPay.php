<?php

namespace App\Domain\Payroll\Data;

/**
 * How one office date of an employee counts for gaji harian (fractions of a
 * day; a half-day leave/permit splits 0.5 / 0.5).
 *
 * presentPaid: worked (Hadir, Terlambat, Pulang cepat, WFH, Dinas);
 * leavePaid / leaveUnpaid: Cuti, Sakit, Izin per the company rules;
 * absent: Alpha; pending: not decided yet (Perlu koreksi, scheduled without
 * any record, today before check-in) — never paid, counted separately.
 */
final readonly class DayPay
{
    public function __construct(
        public float $presentPaid = 0,
        public float $leavePaid = 0,
        public float $leaveUnpaid = 0,
        public float $absent = 0,
        public float $pending = 0,
        public bool $late = false,
        public string $label = 'Tidak dihitung',
    ) {}

    public function paid(): float
    {
        return $this->presentPaid + $this->leavePaid;
    }

    public function counts(): bool
    {
        return $this->paid() + $this->leaveUnpaid + $this->absent + $this->pending > 0;
    }
}
