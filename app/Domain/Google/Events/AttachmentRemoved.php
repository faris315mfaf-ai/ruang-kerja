<?php

namespace App\Domain\Google\Events;

use App\Models\Attachment;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * An attachment was detached (soft deleted; the Drive file stays).
 * Dispatched after commit; see AttachmentAdded.
 */
final class AttachmentRemoved implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public Attachment $attachment,
        public ?string $userId = null,
    ) {}
}
