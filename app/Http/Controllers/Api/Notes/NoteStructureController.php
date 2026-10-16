<?php

namespace App\Http\Controllers\Api\Notes;

use App\Domain\Notes\Actions\CreateNote;
use App\Domain\Notes\Actions\DeleteNote;
use App\Domain\Notes\Actions\MoveNote;
use App\Domain\Notes\Queries\DocumentTabs;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\NoteCreateRequest;
use App\Http\Requests\Api\NoteMoveRequest;
use App\Http\Resources\Api\NoteDetail;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Structure of the notes tree for the mobile app (API v1, B3-B): create a
 * note / folder / tab / sub-page, move (and reorder), delete, and the tabs
 * of a document. Thin over the web Actions (CreateNote, MoveNote,
 * DeleteNote) and NotePolicy — the same rules as the web tree.
 */
class NoteStructureController extends Controller
{
    /** POST /catatan — note, folder, or tab/sub-page when `parent_id` is sent. */
    public function store(NoteCreateRequest $request, #[CurrentUser] User $user, CreateNote $create, NoteLibrary $library): JsonResponse
    {
        $workspace = $this->workspaceOf($request, $user);

        Gate::authorize('create', [Note::class, $workspace]);

        $note = $create->handle($user, $workspace, [
            'title' => $request->string('title')->toString(),
            'parent_id' => $request->filled('parent_id') ? $request->string('parent_id')->toString() : null,
            'kind' => $request->string('kind', 'note')->toString(),
        ]);

        return response()->json(['note' => NoteDetail::forApp($note, $user, $library)], 201);
    }

    /** PATCH /catatan/{note}/pindah {parent_id, position?} */
    public function move(NoteMoveRequest $request, Note $note, #[CurrentUser] User $user, MoveNote $move, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('update', $note);

        $parentId = $request->input('parent_id');
        $position = $request->input('position');

        $move->handle($note, $user, is_string($parentId) ? $parentId : null, is_numeric($position) ? (int) $position : null);

        return response()->json(['note' => NoteDetail::forApp($note->refresh(), $user, $library)]);
    }

    /** DELETE /catatan/{note} — soft delete; sub-notes move up to the parent. */
    public function destroy(Note $note, #[CurrentUser] User $user, DeleteNote $delete): JsonResponse
    {
        Gate::authorize('delete', $note);

        $payload = [
            'deleted' => true,
            'id' => $note->id,
            'kind' => $note->kind->value,
            'workspace_id' => $note->workspace_id,
            // Where the children went — a deleted tab sends the app back here.
            'parent_id' => $note->parent_id,
        ];

        $delete->handle($note, $user);

        return response()->json($payload);
    }

    /** GET /catatan/{note}/tab — the document's tabs and sub-tabs. */
    public function tabs(Note $note, #[CurrentUser] User $user, DocumentTabs $tabs): JsonResponse
    {
        Gate::authorize('view', $note);
        abort_if($note->isFolder(), 404);

        return response()->json($tabs->forNote($note, $user));
    }

    /**
     * The workspace of a new note: the given one, or the parent's when only
     * `parent_id` is sent. A workspace the user cannot see is 404 (the
     * create policy answers it), an unknown parent a validation error.
     */
    private function workspaceOf(Request $request, User $user): Workspace
    {
        if ($request->filled('workspace_id')) {
            $workspace = Workspace::query()->find($request->string('workspace_id')->toString());

            abort_if($workspace === null, 404);

            return $workspace;
        }

        $parent = Note::query()->visibleTo($user)->with('workspace')->find($request->string('parent_id')->toString());

        if ($parent === null || $parent->workspace === null) {
            throw ValidationException::withMessages(['parent_id' => 'Folder atau catatan induk tidak ditemukan.']);
        }

        return $parent->workspace;
    }
}
