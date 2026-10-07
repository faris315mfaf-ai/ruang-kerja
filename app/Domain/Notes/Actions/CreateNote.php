<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteKind;
use App\Domain\Notes\Enums\NotePreset;
use App\Domain\Tasks\Services\Lexorank;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\NotePolicy;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * New empty note or folder at the end of its siblings (lexorank). The parent
 * must be a note/folder of the same workspace that the author can open; a
 * folder only goes at the root or inside another folder. Authorization
 * (NotePolicy::create) is the caller's job.
 */
final class CreateNote
{
    public function __construct(private readonly NotePolicy $policy) {}

    /**
     * @param  array{title: string, parent_id?: string|null, access?: string|null, kind?: string|null, preset?: string|null}  $data
     */
    public function handle(User $author, Workspace $workspace, array $data): Note
    {
        $kind = NoteKind::tryFrom((string) ($data['kind'] ?? '')) ?? NoteKind::Note;
        $title = self::normalizeTitle($data['title'], $kind);
        $parentId = $data['parent_id'] ?? null;

        if ($parentId !== null) {
            $parent = Note::query()->where('workspace_id', $workspace->id)->find($parentId);

            if ($parent === null || ! $this->policy->canView($author, $parent)) {
                throw ValidationException::withMessages(['parent_id' => 'Folder atau catatan induk tidak ditemukan di workspace ini.']);
            }

            self::assertParentAccepts($parent, $kind);
        }

        return DB::transaction(function () use ($author, $workspace, $title, $parentId, $data, $kind): Note {
            // Serializes sibling positions of concurrent creates in the workspace.
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();

            $last = Note::query()
                ->where('workspace_id', $workspace->id)
                ->where('parent_id', $parentId)
                ->orderByDesc('position')
                ->value('position');

            return Note::query()->create([
                'company_id' => $workspace->company_id,
                'workspace_id' => $workspace->id,
                'parent_id' => $parentId,
                'kind' => $kind,
                'preset' => $kind === NoteKind::Note ? NotePreset::tryFrom((string) ($data['preset'] ?? '')) : null,
                'title' => $title,
                'access' => NoteAccess::tryFrom((string) ($data['access'] ?? '')) ?? NoteAccess::Workspace,
                'content' => null,
                'content_text' => '',
                'created_by' => $author->id,
                'updated_by' => $author->id,
                'position' => Lexorank::between(is_string($last) ? $last : null, null),
            ]);
        });
    }

    /**
     * Folders only nest in folders (a folder is never a sub-page of a note).
     */
    public static function assertParentAccepts(Note $parent, NoteKind $kind): void
    {
        if ($kind === NoteKind::Folder && ! $parent->isFolder()) {
            throw ValidationException::withMessages(['parent_id' => 'Folder hanya bisa berada di akar atau di dalam folder lain.']);
        }
    }

    public static function normalizeTitle(string $title, NoteKind $kind = NoteKind::Note): string
    {
        $title = trim((string) preg_replace('/\s+/u', ' ', $title));

        if ($title === '') {
            return $kind === NoteKind::Folder ? 'Folder baru' : 'Tanpa judul';
        }

        return mb_substr($title, 0, 200);
    }
}
