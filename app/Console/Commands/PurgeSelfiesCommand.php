<?php

namespace App\Console\Commands;

use App\Domain\Attendance\Actions\PurgeExpiredSelfies;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Manual run of the monthly selfie retention job (PurgeExpiredSelfiesJob).
 */
#[Signature('attendance:purge-selfies')]
#[Description('Hapus selfie absensi yang lebih tua dari masa retensi (ATTENDANCE_SELFIE_RETENTION_MONTHS)')]
final class PurgeSelfiesCommand extends Command
{
    public function handle(PurgeExpiredSelfies $purge): int
    {
        $now = CarbonImmutable::now();
        $count = $purge->handle($now);
        $this->info("{$count} selfie dihapus (retensi ".max(1, config()->integer('attendance.selfie.retention_months')).' bulan).');

        return self::SUCCESS;
    }
}
