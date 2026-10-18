<?php

namespace App\Domain\Attendance\Jobs;

use App\Domain\Attendance\Actions\PurgeExpiredSelfies;
use App\Domain\Tenancy\Concerns\CompanyAware;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Monthly selfie retention (routes/console.php).
 */
final class PurgeExpiredSelfiesJob implements ShouldBeUnique, ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $timeout = 1800;

    public function handle(PurgeExpiredSelfies $purge): void
    {
        $purge->handle(CarbonImmutable::now());
    }
}
