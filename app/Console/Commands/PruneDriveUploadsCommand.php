<?php

namespace App\Console\Commands;

use App\Domain\Google\Actions\PruneDriveUploads;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('ruangkerja:drive-uploads:prune')]
#[Description('Hapus file sementara unggahan Drive yang ditinggalkan lebih dari 24 jam')]
class PruneDriveUploadsCommand extends Command
{
    public function handle(PruneDriveUploads $prune): int
    {
        $deleted = $prune->handle(CarbonImmutable::now());

        $this->info("{$deleted} unggahan sementara dihapus.");

        return self::SUCCESS;
    }
}
