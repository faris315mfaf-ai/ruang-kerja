<?php

namespace App\Http\Controllers\Api\Notes;

use App\Domain\Notes\Queries\NoteMentionCandidates;
use App\Domain\Notes\Queries\NoteSearch;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\NoteMentionRequest;
use App\Http\Requests\Api\NoteSearchRequest;
use App\Models\Note;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** Search across notes and the "@" picker of the mobile editor (B3-B). */
class NoteDiscoveryController extends Controller
{
    /** GET /catatan/cari?q=&workspace_id=&limit= */
    public function search(NoteSearchRequest $request, #[CurrentUser] User $user, NoteSearch $search): JsonResponse
    {
        Gate::authorize('viewAny', Note::class);

        return response()->json($search->handle(
            $user,
            trim($request->string('q')->toString()),
            $request->filled('workspace_id') ? $request->string('workspace_id')->toString() : null,
            $request->integer('limit', NoteSearch::DEFAULT_LIMIT),
        ));
    }

    /** GET /catatan/{note}/mention?q=&limit= — people who can open the note. */
    public function mentions(NoteMentionRequest $request, Note $note, #[CurrentUser] User $user, NoteMentionCandidates $candidates): JsonResponse
    {
        Gate::authorize('update', $note);

        return response()->json(['people' => $candidates->handle(
            $note,
            $user,
            $request->string('q')->toString(),
            $request->integer('limit', NoteMentionCandidates::DEFAULT_LIMIT),
        )]);
    }
}
