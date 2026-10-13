<?php

namespace App\Http\Controllers\Api\Notes;

use App\Domain\Notes\Actions\UpdateNoteShare;
use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Queries\NoteAccessView;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notes\ShareNoteRequest;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * "Bagikan" of the mobile app (B3-B): general access (workspace / only
 * invited) and invited people with their role, through the web
 * UpdateNoteShare (audit `note.share_updated`) behind NotePolicy::share.
 * People are chosen by user id (the app's people search); the list sent to
 * PUT replaces the stored one.
 */
class NoteAccessController extends Controller
{
    /** GET /catatan/{note}/akses */
    public function show(Note $note, NoteAccessView $view): JsonResponse
    {
        Gate::authorize('view', $note);
        Gate::authorize('share', $note);

        return response()->json(['share' => $view->present($note)]);
    }

    /** PUT /catatan/{note}/akses {access, people:[{user_id, role}]} */
    public function update(ShareNoteRequest $request, Note $note, #[CurrentUser] User $user, UpdateNoteShare $update, NoteAccessView $view): JsonResponse
    {
        Gate::authorize('share', $note);

        /** @var list<array{user_id: string, role: string}> $people */
        $people = array_values($request->array('people'));
        $update->handle($note, $user, NoteAccess::from($request->string('access')->toString()), $people);

        return response()->json(['share' => $view->present($note->refresh())]);
    }

    /** DELETE /catatan/{note}/akses/{person} — remove one invitation. */
    public function destroy(Note $note, string $person, #[CurrentUser] User $user, UpdateNoteShare $update, NoteAccessView $view): JsonResponse
    {
        Gate::authorize('view', $note);
        Gate::authorize('share', $note);

        $remaining = $note->shares()->where('user_id', '!=', $person)->get(['user_id', 'role']);

        abort_if($remaining->count() === $note->shares()->count(), 404, 'Orang ini tidak diundang ke catatan.');

        /** @var list<array{user_id: string, role: string}> $people */
        $people = $remaining->map(fn (NoteShare $share): array => ['user_id' => $share->user_id, 'role' => $share->role->value])->values()->all();

        $update->handle($note, $user, $note->access, $people);

        return response()->json(['share' => $view->present($note->refresh())]);
    }
}
