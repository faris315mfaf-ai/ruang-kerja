<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Notes\Services\CollabBridge;
use App\Models\Note;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

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

        // Compare and store under the row lock: checking updated_at before
        // the transaction let two saves on the same base both pass.
        DB::transaction(function () use ($note, $editor, $document, $base): void {
            /** @var Note $locked */
            $locked = Note::query()->whereKey($note->id)->lockForUpdate()->firstOrFail();

            if ($locked->updated_at !== null && $locked->updated_at->getTimestamp() !== $base->getTimestamp()) {
                throw new HttpResponseException(response()->json([
                    'message' => 'Catatan ini baru saja diubah orang lain. Muat ulang untuk melihat versi terbaru sebelum menyimpan.',
                    'updated_at' => $locked->updated_at->toIso8601String(),
                ], 409));
            }

            $this->store->handle($note, null, $document, $editor);
        });

        $this->collab->replace($note, $note->content);

        return $note;
    }
}
