<?php

namespace App\Console\Commands;

use App\Domain\Notifications\Actions\DispatchDueDailyDigests;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('notifications:send-daily-digests')]
#[Description('Antrekan ringkasan harian untuk pengguna yang jam kirimnya sudah tiba (Asia/Jakarta)')]
class SendDailyDigests extends Command
{
    public function handle(DispatchDueDailyDigests $dispatch): int
    {
        $queued = $dispatch->handle(CarbonImmutable::now());

        $this->info("{$queued} ringkasan harian diantrekan.");

        return self::SUCCESS;
    }
}
