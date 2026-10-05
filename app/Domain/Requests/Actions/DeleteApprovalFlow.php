<?php

namespace App\Domain\Requests\Actions;

use App\Models\ApprovalFlow;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Soft-deletes a flow no leave type uses. The company "Default" flow stays.
 */
final class DeleteApprovalFlow
{
    public function handle(User $actor, ApprovalFlow $flow): void
    {
        if ($flow->name === ApprovalFlow::DEFAULT_NAME) {
            throw ValidationException::withMessages(['flow' => 'Alur default tidak bisa dihapus.']);
        }

        if ($flow->leaveTypes()->exists()) {
            throw ValidationException::withMessages(['flow' => 'Alur masih dipakai jenis pengajuan. Pindahkan jenisnya ke alur lain dulu.']);
        }

        $flow->delete();
    }
}
