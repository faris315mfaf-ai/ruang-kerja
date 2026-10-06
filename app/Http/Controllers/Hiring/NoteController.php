<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\DeleteCandidateNote;
use App\Domain\Hiring\Actions\SaveCandidateNote;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\NoteRequest;
use App\Models\Candidate;
use App\Models\CandidateNote;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/** Notulensi: every reviewer adds; only the author edits or deletes. */
class NoteController extends Controller
{
    public function store(NoteRequest $request, Candidate $candidate, #[CurrentUser] User $user, SaveCandidateNote $save): RedirectResponse
    {
        Gate::authorize('note', $candidate);

        $save->handle($user, $candidate, null, $request->string('body')->toString());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Notulensi ditambahkan.']);

        return back();
    }

    public function update(NoteRequest $request, CandidateNote $note, #[CurrentUser] User $user, SaveCandidateNote $save): RedirectResponse
    {
        Gate::authorize('update', $note);

        $save->handle($user, $note->candidate, $note, $request->string('body')->toString());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Notulensi disimpan.']);

        return back();
    }

    public function destroy(CandidateNote $note, DeleteCandidateNote $delete): RedirectResponse
    {
        Gate::authorize('delete', $note);

        $delete->handle($note);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Notulensi dihapus.']);

        return back();
    }
}
