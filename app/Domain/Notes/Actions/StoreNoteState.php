<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Notes\Services\NoteContent;
use App\Models\Note;
use App\Models\NoteVersion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Persists the state of a note document — called by the collab server
 * (debounced, POST /internal/catatan/{note}/state) and by the save fallback
 * without collaboration (SaveNoteContent, `$yjsState` null = rebuild the
 * Yjs doc from `content` on the next load).
 *
 * - `content` is sanitized (NoteContent: RichText whitelist, mentions only
 *   for people who can open the note) and stored with its plain text.
 * - Before the content changes, the previous state is kept as a version
 *   when the latest version is older than 5 minutes (so the history has a
 *   point at least every 5 minutes of editing, not one per keystroke).
 * - New mentions are notified after commit (SyncNoteMentions).
 */
final class StoreNoteState
{
    public const int VERSION_INTERVAL_MINUTES = 5;

    public function __construct(
        private readonly NoteContent $content,
        private readonly SyncNoteMentions $mentions,
    ) {}

    /**
     * @param  array<mixed>|null  $document
     */
    public function handle(Note $note, ?string $yjsState, ?array $document, ?User $editor): Note
    {
        if ($note->isFolder()) {
            throw ValidationException::withMessages(['content' => 'Folder tidak punya isi.']);
        }

        $violation = NoteContent::violation($document);

        if ($violation !== null) {
            throw ValidationException::withMessages(['content' => $violation]);
        }

        $prepared = $this->content->prepare($note, $document);

        $changed = DB::transaction(function () use ($note, $yjsState, $prepared, $editor): bool {
            /** @var Note $locked */
            $locked = Note::query()->whereKey($note->id)->lockForUpdate()->firstOrFail();
            $changed = ! NoteContent::same($locked->content, $prepared['document']);

            if ($changed) {
                $this->keepPreviousVersion($locked);
            }

            $locked->yjs_state = $yjsState;

            if ($changed) {
                $locked->forceFill([
                    'content' => $prepared['document'],
                    'content_text' => $prepared['text'],
                    'updated_by' => $editor->id ?? $locked->updated_by,
                ]);
                $locked->save();
            } else {
                // Same visible content (e.g. only CRDT metadata): no new "edited" time.
                $locked->timestamps = false;
                $locked->save();
                $locked->timestamps = true;
            }

            $note->setRawAttributes($locked->getAttributes(), true);

            return $changed;
        });

        if ($changed && $editor !== null) {
            $this->mentions->handle($note, $editor, $prepared['mentioned_ids']);
        }

        return $note;
    }

    /**
     * Snapshot of the state the note had before this change, unless the
     * latest version is recent (or already holds that content).
     */
    private function keepPreviousVersion(Note $note): void
    {
        if ($note->content === null) {
            return;
        }

        $latest = NoteVersion::query()->where('note_id', $note->id)->latest('created_at')->latest('id')->first();
        $threshold = CarbonImmutable::now()->subMinutes(self::VERSION_INTERVAL_MINUTES);

        if ($latest !== null && ($latest->created_at->greaterThan($threshold) || NoteContent::same($latest->content, $note->content))) {
            return;
        }

        NoteVersion::query()->create([
            'note_id' => $note->id,
            'yjs_state' => $note->yjs_state,
            'content' => $note->content,
            'title' => $note->title,
            'created_by' => $note->updated_by,
            // The time this state was reached, not the time it was archived.
            'created_at' => $note->updated_at ?? now(),
        ]);
    }
}
