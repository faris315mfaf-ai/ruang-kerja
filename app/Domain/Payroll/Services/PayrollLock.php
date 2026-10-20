<?php

namespace App\Domain\Payroll\Services;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Payroll\Models\PayrollPeriod;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * Whether a payroll month of a company is locked (Absensi › Gaji › Kunci).
 * A locked month freezes its attendance and wages: corrections, manual
 * statuses and wage changes dated in it are refused. Scoped binding, so the
 * lookups are memoized for one request / job (forget() after lock/unlock).
 */
final class PayrollLock
{
    /** @var array<string, bool> "{company}|{Y-m}" => locked */
    private array $locked = [];

    /**
     * @param  CarbonInterface  $date  an office date of the month
     */
    public function isLocked(string $companyId, CarbonInterface $date): bool
    {
        $month = $date->format('Y-m');

        return $this->locked["{$companyId}|{$month}"] ??= PayrollPeriod::query()
            ->where('company_id', $companyId)
            ->whereDate('month', $month.'-01')
            ->whereNotNull('locked_at')
            ->exists();
    }

    /**
     * @throws ValidationException when the month of $date is locked
     */
    public function assertOpen(string $companyId, CarbonInterface $date, string $field = 'work_date'): void
    {
        if ($this->isLocked($companyId, $date)) {
            throw ValidationException::withMessages([$field => self::message($date)]);
        }
    }

    /**
     * "Periode gaji Oktober 2026 sudah dikunci. Buka kunci di Absensi › Gaji dulu."
     */
    public static function message(CarbonInterface $date): string
    {
        $label = RecapPeriod::MONTHS[$date->month - 1].' '.$date->year;

        return "Periode gaji {$label} sudah dikunci. Buka kunci di Absensi › Gaji dulu.";
    }

    public function forget(): void
    {
        $this->locked = [];
    }
}
