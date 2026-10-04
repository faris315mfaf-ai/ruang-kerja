<?php

namespace App\Console\Commands;

use App\Domain\Notifications\Actions\PruneNotifications;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('notifications:prune')]
#[Description('Hapus notifikasi yang lebih lama dari masa simpan (kecuali yang masih perlu tindakan)')]
class PruneNotificationsCommand extends Command
{
    public function handle(PruneNotifications $prune): int
    {
        $deleted = $prune->handle(CarbonImmutable::now());

        $this->info("{$deleted} notifikasi dihapus.");

        return self::SUCCESS;
    }
}
