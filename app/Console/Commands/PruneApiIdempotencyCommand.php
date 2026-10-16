<?php

namespace App\Console\Commands;

use App\Http\Middleware\IdempotentRequests;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Daily: removes API idempotency keys older than 72 hours (the longest an
 * offline write may wait before it is synced).
 */
#[Signature('api:prune-idempotency')]
#[Description('Hapus kunci idempotensi API yang lebih tua dari 72 jam')]
final class PruneApiIdempotencyCommand extends Command
{
    public function handle(): int
    {
        $deleted = DB::table(IdempotentRequests::TABLE)
            ->where('created_at', '<', Carbon::now()->subHours(IdempotentRequests::RETENTION_HOURS))
            ->delete();

        $this->info($deleted.' kunci idempotensi lama dihapus.');

        return self::SUCCESS;
    }
}
