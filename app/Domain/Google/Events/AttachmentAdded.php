<?php

namespace App\Domain\Google\Events;

use App\Models\Attachment;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A Drive file was newly attached to a parent (task, comment, …) — by the
 * Picker, "Dokumen baru" or a finished upload. Dispatched after commit;
 * the Tasks module records the timeline entry and broadcasts it.
 */
final class AttachmentAdded implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public Attachment $attachment,
        public ?string $userId = null,
    ) {}
}
