<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Services\Lexorank;
use App\Models\TaskStatus;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves a new column order (drag & drop in Pengaturan › Kolom status).
 */
final class ReorderTaskStatuses
{
    /**
     * @param  list<string>  $orderedIds  every status id of the workspace, in the new order
     */
    public function handle(Workspace $workspace, array $orderedIds): void
    {
        /** @var list<string> $current */
        $current = TaskStatus::query()->where('workspace_id', $workspace->id)->pluck('id')->all();

        if (count($orderedIds) !== count($current) || array_diff($current, $orderedIds) !== []) {
            throw ValidationException::withMessages(['status_ids' => 'Urutan kolom tidak lengkap. Muat ulang halaman lalu coba lagi.']);
        }

        $positions = Lexorank::sequence(count($orderedIds));

        DB::transaction(function () use ($orderedIds, $positions): void {
            foreach ($orderedIds as $index => $id) {
                TaskStatus::query()->whereKey($id)->update(['position' => $positions[$index]]);
            }
        });
    }
}
