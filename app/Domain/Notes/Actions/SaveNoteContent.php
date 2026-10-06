<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Notes\Services\CollabBridge;
use App\Models\Note;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * "Mode tanpa kolaborasi": when the collab server cannot be reached the
 * editor saves the whole document with PATCH. Optimistic lock on
 * `updated_at`: a save based on an older version is refused (409) so it
 * never overwrites someone else's newer text. The Yjs state is dropped and,
 * if the collab server still has the document open, its content is
 * replaced there too.
 */
final class SaveNoteContent
{
    public function __construct(
        private readonly StoreNoteState $store,
        private readonly CollabBridge $collab,
    ) {}

    /**
     * @param  array<mixed>|null  $document
     */
    public function handle(Note $note, User $editor, ?array $document, string $baseUpdatedAt): Note
    {
        $base = CarbonImmutable::parse($baseUpdatedAt);

        if ($note->updated_at !== null && $note->updated_at->getTimestamp() !== $base->getTimestamp()) {
            throw new HttpResponseException(response()->json([
                'message' => 'Catatan ini baru saja diubah orang lain. Muat ulang untuk melihat versi terbaru sebelum menyimpan.',
                'updated_at' => $note->updated_at->toIso8601String(),
            ], 409));
        }

        $this->store->handle($note, null, $document, $editor);
        $this->collab->replace($note, $note->content);

        return $note;
    }
}
