<?php

namespace App\Http\Controllers\Notes;

use App\Domain\Notes\Actions\StoreNoteState;
use App\Domain\Notes\Enums\NoteKind;
use App\Domain\Organization\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notes\CollabStateRequest;
use App\Models\Note;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Internal endpoints of the collab server (VerifyCollabSecret, outside the
 * web group): load the persisted state of a note document and store a new
 * one. The collab server already checked the user's token on connect.
 */
class CollabStateController extends Controller
{
    /** GET /internal/catatan/{note}/state */
    public function show(string $note): JsonResponse
    {
        $model = Note::query()->where('kind', NoteKind::Note->value)->findOrFail($note);
        $state = $model->yjs_state;

        return response()->json([
            'id' => $model->id,
            'title' => $model->title,
            'yjs_state' => $state === null ? null : base64_encode($state),
            'content' => $model->content,
        ]);
    }

    /** POST /internal/catatan/{note}/state */
    public function store(CollabStateRequest $request, string $note, StoreNoteState $store): JsonResponse
    {
        $model = Note::query()->where('kind', NoteKind::Note->value)->findOrFail($note);
        $state = base64_decode($request->string('yjs_state')->toString(), true);

        abort_if($state === false, 422, 'yjs_state bukan base64.');

        /** @var list<string> $editorIds */
        $editorIds = array_values($request->array('editor_ids'));
        // The last person who edited before this store is the "updated by".
        $editor = $editorIds === [] ? null : User::query()
            ->whereIn('id', $editorIds)
            ->where('company_id', $model->company_id)
            ->where('status', UserStatus::Active)
            ->get()
            ->sortBy(fn (User $user): int => (int) array_search($user->id, $editorIds, true))
            ->last();

        /** @var array<mixed>|null $body */
        $body = $request->input('body');
        $store->handle($model, $state, $body, $editor);

        return response()->json(['stored' => true, 'updated_at' => $model->updated_at?->toIso8601String()]);
    }
}
