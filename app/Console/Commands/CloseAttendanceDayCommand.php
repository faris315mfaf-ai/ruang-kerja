<?php

namespace App\Console\Commands;

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Services\ScheduleResolver;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Scheduled daily at 00:30 office time (routes/console.php). Without --date it
 * closes the last two work dates: yesterday, and the day before for overnight
 * shifts that were still within their check-out window during the last run.
 * Safe to run repeatedly.
 */
#[Signature('attendance:close-day {--date= : Tanggal kerja (YYYY-MM-DD), bawaan: kemarin dan lusa kemarin}')]
#[Description('Tutup hari absensi: tandai alpha, perlu koreksi (lupa check-out), dan libur')]
final class CloseAttendanceDayCommand extends Command
{
    public function handle(CloseAttendanceDay $closeDay): int
    {
        $option = $this->option('date');

        if (is_string($option) && $option !== '') {
            if (! self::isDate($option)) {
                $this->error('Format --date harus YYYY-MM-DD.');

                return self::INVALID;
            }

            $dates = [ScheduleResolver::parseDate($option)];
        } else {
            $yesterday = ScheduleResolver::officeDate(CarbonImmutable::now())->subDay();
            $dates = [$yesterday->subDay(), $yesterday];
        }

        foreach ($dates as $date) {
            $report = $closeDay->handle($date);

            $this->info(sprintf(
                '%s: %d alpha, %d perlu koreksi, %d libur, %d dihapus, %d ditunda.',
                $report->workDate,
                $report->absent,
                $report->needsCorrection,
                $report->holiday,
                $report->removed,
                $report->deferred,
            ));
        }

        return self::SUCCESS;
    }

    private static function isDate(string $value): bool
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $parts) !== 1) {
            return false;
        }

        return checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
    }
}
