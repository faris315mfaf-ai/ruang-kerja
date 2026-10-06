<?php

namespace App\Domain\Okr\Actions;

use App\Models\KeyResult;
use Illuminate\Support\Facades\DB;

/**
 * Removes a key result with its check-ins and task links (cascade). The
 * linked tasks themselves are untouched.
 */
final class DeleteKeyResult
{
    public function handle(KeyResult $keyResult): void
    {
        DB::transaction(function () use ($keyResult): void {
            $objective = $keyResult->objective;
            $keyResult->delete();
            $objective->touch();
        });
    }
}
