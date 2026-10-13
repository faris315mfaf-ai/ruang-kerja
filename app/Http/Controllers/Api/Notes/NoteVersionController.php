<?php

namespace App\Http\Controllers\Api\Notes;

use App\Domain\Notes\Actions\RestoreNoteVersion;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Domain\Notes\Queries\NoteVersionFeed;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\NoteDetail;
use App\Models\Note;
use App\Models\NoteVersion;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Version history of the mobile app (B3-B): list, safe-HTML preview and
 * "Pulihkan versi ini" (web RestoreNoteVersion behind NoteVersionPolicy:
 * whoever opens the note reads its history, restoring needs edit rights).
 */
class NoteVersionController extends Controller
{
    /** GET /catatan/{note}/versi */
    public function index(Note $note, NoteVersionFeed $feed): JsonResponse
    {
        Gate::authorize('view', $note);

        return response()->json([
            'versions' => $feed->list($note),
            'can_restore' => Gate::allows('update', $note),
        ]);
    }

    /** GET /catatan/{note}/versi/{version} */
    public function show(Note $note, NoteVersion $version, NoteVersionFeed $feed): JsonResponse
    {
        Gate::authorize('view', $note);
        abort_unless($version->note_id === $note->id, 404);
        Gate::authorize('view', $version);

        return response()->json(['version' => $feed->preview($version)]);
    }

    /** POST /catatan/{note}/versi/{version}/pulihkan */
    public function restore(Note $note, NoteVersion $version, #[CurrentUser] User $user, RestoreNoteVersion $restore, NoteLibrary $library, NoteVersionFeed $feed): JsonResponse
    {
        Gate::authorize('view', $note);
        abort_unless($version->note_id === $note->id, 404);
        Gate::authorize('restore', $version);

        $restore->handle($note, $version, $user);

        return response()->json([
            'note' => NoteDetail::forApp($note->refresh(), $user, $library),
            'versions' => $feed->list($note),
        ]);
    }
}
