<?php

namespace App\Http\Controllers\Notes;

use App\Domain\Notes\Actions\CreateNote;
use App\Domain\Notes\Actions\DeleteNote;
use App\Domain\Notes\Actions\MoveNote;
use App\Domain\Notes\Actions\RenameNote;
use App\Domain\Notes\Actions\RestoreNoteVersion;
use App\Domain\Notes\Actions\SaveNoteContent;
use App\Domain\Notes\Actions\UpdateNoteShare;
use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteKind;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Domain\Notes\Services\CollabToken;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notes\SaveNoteContentRequest;
use App\Http\Requests\Notes\ShareNoteRequest;
use App\Http\Requests\Notes\StoreNoteRequest;
use App\Http\Requests\Notes\UpdateNoteRequest;
use App\Models\Note;
use App\Models\NoteVersion;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\NotePolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /catatan (F2-2, docs/fitur/catatan.md): tree of notes per workspace and
 * the editor. Content is edited live on the collab server (token from
 * GET /catatan/{note}/token); the JSON endpoints here cover title, moving,
 * sharing, versions and the save fallback without collaboration.
 */
class NoteController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, NoteLibrary $library): Response
    {
        Gate::authorize('viewAny', Note::class);

        $query = trim((string) $request->query('q', ''));
        $notes = $library->notes($user);

        return Inertia::render('notes/index', [
            'notes' => [
                'viewer_id' => $user->id,
                'people' => $library->people($user),
                'workspaces' => $library->workspaces($user, $notes),
                'notes' => $notes,
                'query' => $query,
                'matches' => $query === '' ? null : $library->search($user, mb_substr($query, 0, 100)),
            ],
        ]);
    }

    public function show(Note $note, #[CurrentUser] User $user, NoteLibrary $library): Response|RedirectResponse
    {
        Gate::authorize('view', $note);

        // A folder has no page of its own: its workspace tab lists it.
        if ($note->isFolder()) {
            return redirect()->route('workspaces.notes', ['workspace' => $note->workspace->key ?? $note->workspace_id]);
        }

        $detail = $library->detail($note, $user);
        $notes = $library->notes($user, $note->workspace_id);

        return Inertia::render('notes/show', [
            'note' => [
                'viewer_id' => $user->id,
                'people' => $library->people($user),
                'workspaces' => $library->workspaces($user, $notes),
                'notes' => $notes,
                'current' => $detail,
                'share' => $detail['can_share'] ? $library->share($note) : null,
                'collab' => CollabToken::enabled(),
            ],
            // Loaded when the history panel opens (router.reload only: versions).
            'versions' => Inertia::optional(fn (): array => $library->versions($note)),
        ]);
    }

    public function store(StoreNoteRequest $request, #[CurrentUser] User $user, CreateNote $create): RedirectResponse
    {
        $workspace = Workspace::query()->find($request->string('workspace_id')->toString());

        abort_if($workspace === null, 404);
        Gate::authorize('create', [Note::class, $workspace]);

        $note = $create->handle($user, $workspace, [
            'title' => $request->string('title')->toString(),
            'parent_id' => $request->filled('parent_id') ? $request->string('parent_id')->toString() : null,
            'kind' => $request->string('kind', NoteKind::Note->value)->toString(),
        ]);

        // A new folder stays on the list it was created from; a note opens in the editor.
        if ($note->isFolder()) {
            Inertia::flash('toast', ['type' => 'success', 'message' => "Folder {$note->title} dibuat."]);

            return back();
        }

        return to_route('notes.show', $note);
    }

    /** Rename and/or move. */
    public function update(UpdateNoteRequest $request, Note $note, #[CurrentUser] User $user, RenameNote $rename, MoveNote $move, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('update', $note);

        if ($request->has('title')) {
            $rename->handle($note, $user, (string) $request->input('title', ''));
        }

        if ($request->has('parent_id')) {
            $parentId = $request->input('parent_id');
            $move->handle($note, $user, is_string($parentId) ? $parentId : null);
        }

        return response()->json(['note' => $library->detail($note->refresh(), $user)]);
    }

    /** PATCH /catatan/{note}/isi — save fallback without collaboration. */
    public function content(SaveNoteContentRequest $request, Note $note, #[CurrentUser] User $user, SaveNoteContent $save, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('update', $note);

        /** @var array<mixed>|null $body */
        $body = $request->input('body');
        $save->handle($note, $user, $body, $request->string('updated_at')->toString());

        return response()->json(['note' => $library->detail($note->refresh(), $user)]);
    }

    public function destroy(Request $request, Note $note, #[CurrentUser] User $user, DeleteNote $delete): RedirectResponse
    {
        Gate::authorize('delete', $note);

        $workspaceKey = $note->workspace?->key;
        $message = $note->isFolder() ? 'Folder dihapus. Isinya dipindah ke tingkat atas.' : 'Catatan dihapus.';
        $delete->handle($note, $user);

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        // ?kembali=workspace: back to the workspace tab the note was opened from.
        return $request->query('kembali') === 'workspace' && $workspaceKey !== null
            ? to_route('workspaces.notes', ['workspace' => $workspaceKey])
            : to_route('notes.index');
    }

    /** PUT /catatan/{note}/akses */
    public function share(ShareNoteRequest $request, Note $note, #[CurrentUser] User $user, UpdateNoteShare $update, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('share', $note);

        /** @var list<array{user_id: string, role: string}> $people */
        $people = array_values($request->array('people'));
        $update->handle($note, $user, NoteAccess::from($request->string('access')->toString()), $people);

        return response()->json(['share' => $library->share($note->refresh())]);
    }

    /** POST /catatan/{note}/versi/{version}/pulihkan */
    public function restore(Note $note, NoteVersion $version, #[CurrentUser] User $user, RestoreNoteVersion $restore, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('view', $note);
        abort_unless($version->note_id === $note->id, 404);
        Gate::authorize('restore', $version);

        $restore->handle($note, $version, $user);

        return response()->json([
            'note' => $library->detail($note->refresh(), $user),
            'versions' => $library->versions($note),
        ]);
    }

    /**
     * GET /catatan/{note}/token — short-lived token for the collab server.
     * 503 when no collab server is configured (the editor saves directly).
     */
    public function token(Note $note, #[CurrentUser] User $user, CollabToken $tokens, NotePolicy $policy): JsonResponse
    {
        Gate::authorize('view', $note);
        abort_if($note->isFolder(), 404);

        abort_unless(CollabToken::enabled(), 503, 'Server kolaborasi belum diatur.');

        $canEdit = $policy->canEdit($user, $note);

        return response()->json([
            'token' => $tokens->issue($note, $user, $canEdit),
            'url' => (string) config('collab.public_url'),
            'can_edit' => $canEdit,
            'expires_in' => CollabToken::ttl(),
        ]);
    }
}
