<?php

namespace App\Domain\Google\Actions;

use App\Domain\Google\Events\AttachmentRemoved;
use App\Models\Attachment;
use App\Models\User;

/**
 * Detaches a file (soft delete). The Drive file itself is not deleted.
 * Authorize first: Gate::authorize('delete', $attachment).
 */
final class RemoveAttachment
{
    public function handle(Attachment $attachment, ?User $by = null): void
    {
        if ($attachment->delete() === true) {
            AttachmentRemoved::dispatch($attachment, $by?->id);
        }
    }
}
