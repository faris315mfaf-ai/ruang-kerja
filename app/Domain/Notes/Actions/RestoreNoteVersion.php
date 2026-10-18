<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Notes\Services\CollabBridge;
use App\Domain\Notes\Services\NoteContent;
use App\Domain\Tasks\Services\RichText;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Note;
use App\Models\NoteVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Pulihkan versi ini": the current state is kept as a version (nothing is
 * lost), then the note takes the title and content of the chosen version
 * and a new version "Dipulihkan dari versi …" marks the restore. The Yjs
 * state is dropped and the collab server replaces the content of the open
 * document, so every editor sees the restored text at once.
 */
final class RestoreNoteVersion
{
    public function __construct(private readonly CollabBridge $collab) {}

    public function handle(Note $note, NoteVersion $version, User $actor): Note
    {
        if ($version->note_id !== $note->id) {
            throw ValidationException::withMessages(['version' => 'Versi ini bukan milik catatan tersebut.']);
        }

        DB::transaction(function () use ($note, $version, $actor): void {
            /** @var Note $locked */
            $locked = Note::query()->whereKey($note->id)->lockForUpdate()->firstOrFail();

            $latest = NoteVersion::query()->where('note_id', $note->id)->latest('created_at')->latest('id')->first();

            if ($locked->content !== null && ($latest === null || ! NoteContent::same($latest->content, $locked->content) || $latest->title !== $locked->title)) {
                NoteVersion::query()->create([
                    'note_id' => $locked->id,
                    'yjs_state' => $locked->yjs_state,
                    'content' => $locked->content,
                    'title' => $locked->title,
                    'created_by' => $locked->updated_by,
                    'created_at' => $locked->updated_at ?? now(),
                ]);
            }

            $locked->forceFill([
                'title' => $version->title,
                'content' => $version->content,
                'content_text' => $version->content === null ? '' : (string) RichText::toText($version->content),
                'yjs_state' => null,
                'updated_by' => $actor->id,
            ])->save();

            NoteVersion::query()->create([
                'note_id' => $locked->id,
                'content' => $version->content,
                'title' => $version->title,
                'label' => 'Dipulihkan dari versi '.$version->created_at->timezone(CurrentCompany::timezone())->translatedFormat('j M Y H.i'),
                'created_by' => $actor->id,
                'created_at' => now(),
            ]);

            $note->setRawAttributes($locked->getAttributes(), true);
        });

        $this->collab->replace($note, $note->content);

        return $note;
    }
}
