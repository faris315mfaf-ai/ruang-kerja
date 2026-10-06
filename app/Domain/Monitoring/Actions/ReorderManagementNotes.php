<?php

namespace App\Domain\Monitoring\Actions;

use App\Domain\Tasks\Services\Lexorank;
use App\Models\ManagementNote;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves the owner's new order of open "catatan tindakan" (drag or the
 * up/down buttons). The list must be exactly the owner's open notes, so a
 * stale screen or someone else's id is refused (422) instead of mixing lists.
 */
final class ReorderManagementNotes
{
    /**
     * @param  list<string>  $ids  open notes, top first
     */
    public function handle(User $user, array $ids): void
    {
        DB::transaction(function () use ($user, $ids): void {
            User::query()->whereKey($user->id)->lockForUpdate()->first(['id']);

            $open = ManagementNote::query()->ownedBy($user)->whereNull('done_at')->pluck('id')->all();
            $given = array_values(array_unique($ids));

            if (count($given) !== count($ids) || count($given) !== count($open) || array_diff($given, $open) !== []) {
                throw ValidationException::withMessages(['ids' => 'Daftar catatan sudah berubah. Muat ulang lalu coba lagi.']);
            }

            foreach (Lexorank::sequence(count($given)) as $index => $position) {
                ManagementNote::query()->whereKey($given[$index])->update(['position' => $position]);
            }
        });
    }

    /**
     * Evenly spaced keys for the open notes in their current order (keys grow
     * when notes keep being added on top).
     */
    public static function rebalance(User $user): void
    {
        $ids = ManagementNote::query()->ownedBy($user)->whereNull('done_at')->orderBy('position')->orderBy('created_at')->pluck('id')->all();

        foreach (Lexorank::sequence(count($ids)) as $index => $position) {
            ManagementNote::query()->whereKey($ids[$index])->update(['position' => $position]);
        }
    }
}
