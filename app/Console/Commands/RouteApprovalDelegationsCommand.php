<?php

namespace App\Console\Commands;

use App\Domain\Requests\Actions\RouteToDelegates;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('requests:route-delegations')]
#[Description('Alihkan langkah persetujuan yang menunggu ke delegasi yang aktif hari ini.')]
class RouteApprovalDelegationsCommand extends Command
{
    public function handle(RouteToDelegates $route): int
    {
        $this->info($route->handle().' langkah dialihkan ke delegasi.');

        return self::SUCCESS;
    }
}
