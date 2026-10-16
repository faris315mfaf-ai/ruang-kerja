<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\RequestAttachmentStore;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Hapus draf" (mobile app): removes an own draft that was never sent — no
 * number, no approval steps, no balance reservation — together with its
 * attachments (rows now, files after commit). A request that was sent once
 * (also one sent back for revision) is history and can only be canceled
 * (CancelRequest).
 */
final class DeleteRequestDraft
{
    public function __construct(private readonly RequestAttachmentStore $attachments) {}

    public function handle(User $actor, EmployeeRequest $request): void
    {
        $paths = DB::transaction(function () use ($actor, $request): array {
            $request = EmployeeRequest::query()->lockForUpdate()->findOrFail($request->id);

            if ($request->user_id !== $actor->id) {
                throw new AuthorizationException('Hanya pemohon yang bisa menghapus draf ini.');
            }

            if ($request->status !== RequestStatus::Draft || $request->submitted_at !== null) {
                throw ValidationException::withMessages(['status' => 'Hanya draf yang belum pernah dikirim yang bisa dihapus. Batalkan pengajuan ini.']);
            }

            $ids = array_values(array_map('strval', $request->attachments()->pluck('id')->all()));
            $paths = $this->attachments->detach($request, $ids);
            $request->approvals()->delete();
            $request->delete();

            return $paths;
        });

        $this->attachments->delete($paths);
    }
}
