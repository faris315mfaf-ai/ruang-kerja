<?php

namespace App\Http\Controllers\Notes;

use App\Domain\Notes\Actions\StartQuickMinutes;
use App\Domain\Notes\Queries\NoteLibrary;
use App\Http\Controllers\Controller;
use App\Models\Note;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Notulensi cepat (keputusan pemilik 6 Okt 2026, docs/fitur/catatan.md):
 * the dashboard button starts minutes in one tap and opens them in note-
 * taking mode (`?mode=catat`); its menu lists the latest minutes, fetched
 * on demand so the dashboards keep their query budget.
 */
class QuickMinutesController extends Controller
{
    /** POST /catatan/notulensi */
    public function store(#[CurrentUser] User $user, StartQuickMinutes $start): RedirectResponse
    {
        $note = $start->handle($user);

        return redirect()->to(route('notes.show', $note, absolute: false).'?mode=catat');
    }

    /** GET /catatan/notulensi — latest minutes the viewer can open. */
    public function index(#[CurrentUser] User $user, NoteLibrary $library): JsonResponse
    {
        Gate::authorize('viewAny', Note::class);

        return response()->json(['minutes' => $library->recentMinutes($user)]);
    }
}
