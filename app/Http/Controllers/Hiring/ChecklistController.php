<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\AddChecklistItem;
use App\Domain\Hiring\Actions\DeleteChecklistItem;
use App\Domain\Hiring\Actions\SetChecklistItem;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\ChecklistRequest;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Candidate checklist: HR adds/removes items; every reviewer ticks their own
 * (JSON, optimistic in the UI).
 */
class ChecklistController extends Controller
{
    public function store(ChecklistRequest $request, Candidate $candidate, #[CurrentUser] User $user, AddChecklistItem $add): RedirectResponse
    {
        Gate::authorize('manage', $candidate);

        $add->handle(
            $user,
            $candidate,
            $request->string('label')->toString(),
            $request->filled('reviewer_id') ? $request->string('reviewer_id')->toString() : null,
            $request->boolean('required', true),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Butir checklist ditambahkan.']);

        return back();
    }

    public function update(ChecklistRequest $request, CandidateChecklistItem $item, #[CurrentUser] User $user, SetChecklistItem $set): JsonResponse
    {
        Gate::authorize('check', $item);

        $item = $set->handle($user, $item, $request->boolean('checked'), $request->filled('note') ? $request->string('note')->toString() : null);

        return response()->json([
            'id' => $item->id,
            'checked_at' => $item->checked_at?->toIso8601String(),
            'note' => $item->note,
        ]);
    }

    public function destroy(CandidateChecklistItem $item, DeleteChecklistItem $delete): RedirectResponse
    {
        Gate::authorize('delete', $item);

        $delete->handle($item);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Butir checklist dihapus.']);

        return back();
    }
}
