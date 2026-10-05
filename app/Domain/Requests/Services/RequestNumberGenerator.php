<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Support\OfficeTime;
use App\Models\LeaveType;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Sequential request numbers per type code and office month: CUT-2026-10-0001.
 *
 * One atomic upsert (`INSERT … ON CONFLICT DO UPDATE … RETURNING`): PostgreSQL
 * locks the counter row, so concurrent submissions never get the same number.
 */
final class RequestNumberGenerator
{
    public function next(LeaveType $type, CarbonInterface $at): string
    {
        $key = $type->code.'-'.OfficeTime::local($at)->format('Y-m');

        $row = DB::selectOne(
            'INSERT INTO request_sequences (id, key, last_number, created_at, updated_at)
             VALUES (?, ?, 1, now(), now())
             ON CONFLICT (key) DO UPDATE
                SET last_number = request_sequences.last_number + 1, updated_at = now()
             RETURNING last_number',
            [(string) Str::ulid(), $key],
        );

        if (! is_object($row) || ! isset($row->last_number) || ! is_numeric($row->last_number)) {
            throw new RuntimeException("Could not allocate a request number for {$key}.");
        }

        return sprintf('%s-%04d', $key, (int) $row->last_number);
    }
}
