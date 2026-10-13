<?php

namespace App\Http\Controllers\Api\Notes;

use App\Domain\Notes\Actions\CreateNote;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Domain\Notes\Queries\NoteTree;
use App\Domain\Notes\Services\NoteHtml;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\WorkspaceNoteStoreRequest;
use App\Http\Resources\Api\NoteDetail;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\NotePolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Tab "Catatan" of a workspace for the mobile app (API v1): the note list of
 * that workspace (the web NoteLibrary rows — title, diperbarui, penulis —
 * enriched with names, folders above notes; plus the nested `tree`) and "Catatan baru" through the
 * web CreateNote behind NotePolicy::create. Only workspaces visible to the
 * caller resolve (the {workspace} binder answers 404 first).
 */
class WorkspaceNotesController extends Controller
{
    public function index(Workspace $workspace, #[CurrentUser] User $user, NoteLibrary $library, NoteTree $tree): JsonResponse
    {
        Gate::authorize('view', $workspace);

        $notes = $this->withNames($library->notes($user, $workspace->id));

        return response()->json([
            'workspace' => [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->name,
                'archived' => $workspace->isArchived(),
            ],
            'can_create' => app(NotePolicy::class)->canCreateIn($user, $workspace),
            // Flat rows (the original shape) and the same rows nested for
            // the tree view (B3-B): folders, notes, sub-pages, my_role.
            'notes' => $notes,
            'tree' => $tree->build($user, $workspace, $notes),
        ]);
    }

    public function store(WorkspaceNoteStoreRequest $request, Workspace $workspace, #[CurrentUser] User $user, CreateNote $create, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('create', [Note::class, $workspace]);

        $note = $create->handle($user, $workspace, ['title' => $request->string('title')->toString()]);

        return response()->json(['note' => [
            ...NoteDetail::make($note, $user, $library),
            // Same field as GET /catatan/{note} (NoteController).
            'mobile_editable' => ! $note->isFolder() && NoteHtml::isMobileEditable(is_array($note->content) ? $note->content : null),
        ]], 201);
    }

    /**
     * The rows carry author ids; the app has no people list, so the names of
     * penulis (created_by) and penyunting terakhir (updated_by) ride along —
     * one query regardless of the number of notes.
     *
     * @param  list<array<string, mixed>>  $notes
     * @return list<array<string, mixed>>
     */
    private function withNames(array $notes): array
    {
        $ids = [];

        foreach ($notes as $note) {
            foreach (['created_by', 'updated_by'] as $field) {
                if (is_string($note[$field] ?? null) && $note[$field] !== '') {
                    $ids[] = $note[$field];
                }
            }
        }

        /** @var array<string, string> $names */
        $names = $ids === []
            ? []
            : User::query()->whereIn('id', array_values(array_unique($ids)))->pluck('name', 'id')->all();

        return array_map(
            fn (array $note): array => [
                ...$note,
                'penulis' => $names[$note['created_by'] ?? ''] ?? null,
                'penyunting' => $names[$note['updated_by'] ?? ''] ?? null,
            ],
            $notes,
        );
    }
}
