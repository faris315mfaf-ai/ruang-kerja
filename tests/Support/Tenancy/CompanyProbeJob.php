<?php

namespace Tests\Support\Tenancy;

use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Records the CompanyContext it runs in (tests/Feature/Tenancy/CompanyContextTest.php).
 */
final class CompanyProbeJob implements ShouldQueue
{
    use CompanyAware;
    use Queueable;

    /** @var list<string|null> */
    public static array $seen = [];

    public function __construct(public readonly ?User $user = null) {}

    public function handle(CompanyContext $context): void
    {
        self::$seen[] = $context->id();
    }
}
