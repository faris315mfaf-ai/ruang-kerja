<?php

namespace App\Domain\Monitoring\Actions;

use App\Domain\Tasks\Services\Lexorank;
use App\Models\ManagementNote;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Adds a "catatan tindakan" at the top of the owner's open notes
 * (keputusan pemilik 6 Okt 2026). Authorized by ManagementNotePolicy::create.
 */
final class CreateManagementNote
{
    public function handle(User $user, string $body, ?string $dueOn = null): ManagementNote
    {
        return DB::transaction(function () use ($user, $body, $dueOn): ManagementNote {
            // Serialize writes of one person's list (position + limit).
            User::query()->whereKey($user->id)->lockForUpdate()->first(['id']);

            if (ManagementNote::query()->ownedBy($user)->count() >= ManagementNote::LIMIT) {
                throw ValidationException::withMessages([
                    'body' => 'Catatan tindakan sudah '.ManagementNote::LIMIT.'. Hapus catatan yang selesai terlebih dahulu.',
                ]);
            }

            $first = ManagementNote::query()->ownedBy($user)->whereNull('done_at')->orderBy('position')->value('position');

            if (is_string($first) && strlen($first) >= Lexorank::MAX_LENGTH - 1) {
                ReorderManagementNotes::rebalance($user);
                $first = ManagementNote::query()->ownedBy($user)->whereNull('done_at')->orderBy('position')->value('position');
            }

            return ManagementNote::query()->create([
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'body' => trim($body),
                'due_on' => $dueOn,
                'position' => Lexorank::between(null, is_string($first) ? $first : null),
            ]);
        });
    }
}
