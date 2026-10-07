<?php

namespace App\Domain\Hiring\Actions;

use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves the order of a position's questions (ids in the new order; every
 * question of the position exactly once).
 */
final class ReorderHiringQuestions
{
    /**
     * @param  list<string>  $ids
     */
    public function handle(HiringPosition $position, array $ids): void
    {
        $current = $position->questions()->pluck('id')->all();

        if (count($ids) !== count($current) || array_diff($current, $ids) !== []) {
            throw ValidationException::withMessages(['ids' => 'Urutan pertanyaan tidak lengkap. Muat ulang halaman lalu coba lagi.']);
        }

        DB::transaction(function () use ($ids): void {
            foreach ($ids as $index => $id) {
                HiringQuestion::query()->whereKey($id)->update(['position' => $index + 1]);
            }
        });
    }
}
