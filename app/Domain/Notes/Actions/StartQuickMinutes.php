<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Notes\Enums\NotePreset;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Models\Note;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Gate;

/**
 * "Mulai notulensi" (keputusan pemilik 6 Okt 2026, docs/fitur/catatan.md):
 * one tap from any dashboard creates a note in the author's personal
 * workspace, titled with the office date and time, with the minutes
 * template (participants, agenda, discussion, decisions, follow-ups). It
 * is an ordinary note: it can be moved or shared later. Authorization:
 * NotePolicy::create on the personal workspace (an inactive author never
 * passes).
 */
final class StartQuickMinutes
{
    public function __construct(
        private readonly EnsurePersonalWorkspace $personal,
        private readonly CreateNote $create,
        private readonly StoreNoteState $store,
    ) {}

    public function handle(User $author, ?CarbonImmutable $now = null): Note
    {
        $workspace = $this->personal->handle($author);

        Gate::forUser($author)->authorize('create', [Note::class, $workspace]);

        $at = ($now ?? CarbonImmutable::now())->setTimezone(config()->string('app.office_timezone'));
        $when = self::when($at);

        $note = $this->create->handle($author, $workspace, [
            'title' => "Notulensi · {$when}",
            'preset' => NotePreset::Minutes->value,
        ]);

        // Sanitized like any other save (NoteContent); the collab server
        // builds the Yjs document from `content` on first open.
        return $this->store->handle($note, null, self::template($when), $author);
    }

    /** "Selasa, 06/10/2026 14.05" (office time). */
    public static function when(CarbonImmutable $at): string
    {
        return $at->settings(['locale' => 'id'])->translatedFormat('l, d/m/Y H.i');
    }

    /**
     * Minutes template: date & time, then one section per part of a meeting.
     *
     * @return array<string, mixed>
     */
    public static function template(string $when): array
    {
        $heading = fn (string $text): array => [
            'type' => 'heading',
            'attrs' => ['level' => 2],
            'content' => [['type' => 'text', 'text' => $text]],
        ];
        $emptyItem = fn (string $type = 'listItem'): array => [
            'type' => $type,
            ...($type === 'taskItem' ? ['attrs' => ['checked' => false]] : []),
            'content' => [['type' => 'paragraph']],
        ];

        return [
            'type' => 'doc',
            'content' => [
                ['type' => 'paragraph', 'content' => [
                    ['type' => 'text', 'text' => 'Tanggal & jam: ', 'marks' => [['type' => 'bold']]],
                    ['type' => 'text', 'text' => $when],
                ]],
                $heading('Peserta'),
                ['type' => 'bulletList', 'content' => [$emptyItem()]],
                $heading('Agenda'),
                ['type' => 'orderedList', 'content' => [$emptyItem()]],
                $heading('Pembahasan'),
                ['type' => 'paragraph'],
                $heading('Keputusan'),
                ['type' => 'bulletList', 'content' => [$emptyItem()]],
                $heading('Tindak lanjut'),
                ['type' => 'taskList', 'content' => [$emptyItem('taskItem')]],
            ],
        ];
    }
}
