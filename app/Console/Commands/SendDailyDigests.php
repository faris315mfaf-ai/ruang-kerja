<?php

namespace App\Console\Commands;

use App\Domain\Notifications\Actions\DispatchDueDailyDigests;
use App\Domain\Tenancy\Scheduling\ForEachCompany;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('notifications:send-daily-digests')]
#[Description('Antrekan ringkasan harian untuk pengguna yang jam kirimnya sudah tiba (zona kantor tiap perusahaan)')]
class SendDailyDigests extends Command
{
    public function handle(DispatchDueDailyDigests $dispatch): int
    {
        $now = CarbonImmutable::now();
        // Per company: digest times are office times of each company.
        $queued = ForEachCompany::sum(fn (): int => $dispatch->handle($now));

        $this->info("{$queued} ringkasan harian diantrekan.");

        return self::SUCCESS;
    }
}
