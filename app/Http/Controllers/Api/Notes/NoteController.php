<?php

namespace App\Http\Controllers\Api\Notes;

use App\Domain\Notes\Actions\RenameNote;
use App\Domain\Notes\Actions\SaveNoteContent;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Domain\Notes\Services\NoteHtml;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\NoteUpdateRequest;
use App\Http\Resources\Api\NoteDetail;
use App\Models\Note;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * One note of the mobile app (API v1). GET answers the web detail (title,
 * rights, updated_at) with the last version of the document as body_html
 * (NoteHtml renders the stored Tiptap snapshot). PATCH is the save fallback
 * without collaboration — the REST autosave of the app: `title` runs the web
 * RenameNote, `body_html` runs the web SaveNoteContent (StoreNoteState +
 * versions + mentions) and refuses a save based on an older `updated_at`
 * with the same 409 body as the web. Live Yjs collaboration is not part of
 * this API: the web keeps editing through the collab server, the app
 * autosaves over REST and reloads on 409.
 */
class NoteController extends Controller
{
    public function __construct(
        private readonly NoteLibrary $library,
    ) {}

    public function show(Note $note, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', $note);

        return response()->json(['note' => NoteDetail::make($note, $user, $this->library)]);
    }

    public function update(NoteUpdateRequest $request, Note $note, #[CurrentUser] User $user, RenameNote $rename, SaveNoteContent $save): JsonResponse
    {
        Gate::authorize('update', $note);

        if ($request->has('body_html')) {
            $save->handle(
                $note,
                $user,
                NoteHtml::documentFromHtml($request->string('body_html')->toString()),
                $request->string('updated_at')->toString(),
            );
        } else {
            $rename->handle($note, $user, (string) $request->input('title', ''));
        }

        return response()->json(['note' => NoteDetail::make($note->refresh(), $user, $this->library)]);
    }
}
