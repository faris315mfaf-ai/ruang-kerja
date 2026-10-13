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
use Illuminate\Validation\ValidationException;

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
 *
 * The plain-text editor edits plain text only: `mobile_editable` (detail) is
 * true when the document holds nothing but unmarked paragraphs; a body save
 * on any other note is refused with 409 {code: 'rich_note'} (rename still
 * works) unless the request carries `rich: true` (rich editor, B3-B).
 */
class NoteController extends Controller
{
    public function __construct(
        private readonly NoteLibrary $library,
    ) {}

    public function show(Note $note, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', $note);

        return response()->json(['note' => $this->detail($note, $user)]);
    }

    public function update(NoteUpdateRequest $request, Note $note, #[CurrentUser] User $user, RenameNote $rename, SaveNoteContent $save): JsonResponse
    {
        Gate::authorize('update', $note);

        if ($request->has('body_html')) {
            // The plain-text editor replaces the whole document: a rich note
            // (headings, lists, marks, mentions) would be flattened. An app
            // with a rich editor opts in with `rich: true` (B3-B) and sends
            // the whole formatted HTML back, so nothing is flattened.
            if (! $request->boolean('rich') && ! self::mobileEditable($note)) {
                return response()->json([
                    'code' => 'rich_note',
                    'message' => 'Catatan ini berformat lengkap. Sunting di web.',
                ], 409);
            }

            $save->handle(
                $note,
                $user,
                NoteHtml::documentFromHtml($request->string('body_html')->toString()),
                $request->string('updated_at')->toString(),
            );
        } elseif ($request->has('title')) {
            $rename->handle($note, $user, (string) $request->input('title', ''));
        } else {
            throw ValidationException::withMessages([
                'title' => 'Kirim title atau body_html.',
            ]);
        }

        return response()->json(['note' => $this->detail($note->refresh(), $user)]);
    }

    /**
     * NoteDetail plus `mobile_editable`: whether the app may edit the body
     * (NoteHtml::isMobileEditable — plain paragraphs only). Folders: false.
     *
     * @return array<string, mixed>
     */
    private function detail(Note $note, User $user): array
    {
        return [
            ...NoteDetail::make($note, $user, $this->library),
            'mobile_editable' => self::mobileEditable($note),
        ];
    }

    private static function mobileEditable(Note $note): bool
    {
        return ! $note->isFolder() && NoteHtml::isMobileEditable(is_array($note->content) ? $note->content : null);
    }
}
