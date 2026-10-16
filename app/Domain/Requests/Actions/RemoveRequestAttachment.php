<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Requests\Services\RequestAttachmentStore;
use App\Models\Attachment;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Drops one attachment of an own request that is still being edited (draft or
 * sent back for revision) — the web form's "remove_attachments", one at a
 * time. The file is deleted from the private disk after the commit.
 */
final class RemoveRequestAttachment
{
    public function __construct(private readonly RequestAttachmentStore $attachments) {}

    public function handle(User $actor, EmployeeRequest $request, Attachment $attachment): void
    {
        $paths = DB::transaction(function () use ($actor, $request, $attachment): array {
            $request = EmployeeRequest::query()->lockForUpdate()->findOrFail($request->id);

            if ($request->user_id !== $actor->id) {
                throw new AuthorizationException('Hanya pemohon yang bisa menghapus lampiran.');
            }

            if (! $request->status->isEditable()) {
                throw ValidationException::withMessages(['attachments' => 'Lampiran hanya bisa diubah pada draf atau pengajuan yang diminta revisi.']);
            }

            $paths = $this->attachments->detach($request, [$attachment->id]);
            $request->touch();

            return $paths;
        });

        $this->attachments->delete($paths);
    }
}
