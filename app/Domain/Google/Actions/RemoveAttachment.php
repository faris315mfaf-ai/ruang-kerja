<?php

namespace App\Domain\Google\Actions;

use App\Models\Attachment;

/**
 * Detaches a file (soft delete). The Drive file itself is not deleted.
 * Authorize first: Gate::authorize('delete', $attachment).
 */
final class RemoveAttachment
{
    public function handle(Attachment $attachment): void
    {
        $attachment->delete();
    }
}
