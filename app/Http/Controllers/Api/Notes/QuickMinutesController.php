<?php

namespace App\Http\Controllers\Api\Notes;

use App\Domain\Notes\Actions\StartQuickMinutes;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\NoteDetail;
use App\Models\Note;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * "Mulai notulensi" of the mobile app (B3-B): StartQuickMinutes creates the
 * minutes note in the user's personal workspace; the latest ones feed the
 * "Notulensi terakhir" sheet (NoteLibrary::recentMinutes, same as the web).
 */
class QuickMinutesController extends Controller
{
    /** POST /catatan/notulensi */
    public function start(#[CurrentUser] User $user, StartQuickMinutes $start, NoteLibrary $library): JsonResponse
    {
        $note = $start->handle($user);

        // `mode: catat` = open it in note-taking mode (the web `?mode=catat`).
        return response()->json([
            'note' => NoteDetail::forApp($note, $user, $library),
            'mode' => 'catat',
        ], 201);
    }

    /** GET /catatan/notulensi/terakhir?limit= (also GET /catatan/notulensi) */
    public function recent(Request $request, #[CurrentUser] User $user, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('viewAny', Note::class);

        $limit = max(1, min((int) $request->query('limit', 3), 10));

        return response()->json(['minutes' => $library->recentMinutes($user, $limit)]);
    }
}
