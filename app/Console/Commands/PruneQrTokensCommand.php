<?php

namespace App\Console\Commands;

use App\Domain\Attendance\Actions\PruneQrTokens;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Daily: deletes displayed kiosk QR codes nobody scanned.
 */
#[Signature('attendance:prune-qr-tokens')]
#[Description('Hapus kode QR kiosk lama yang tidak pernah dipindai')]
final class PruneQrTokensCommand extends Command
{
    public function handle(PruneQrTokens $prune): int
    {
        $this->info($prune->handle(CarbonImmutable::now()).' kode QR lama dihapus.');

        return self::SUCCESS;
    }
}
