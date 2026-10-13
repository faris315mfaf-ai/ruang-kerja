<?php

namespace App\Http\Controllers\Api\Hiring;

use App\Domain\Hiring\Actions\DeleteCandidateNote;
use App\Domain\Hiring\Actions\SaveCandidateNote;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\NoteRequest;
use App\Models\Candidate;
use App\Models\CandidateNote;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * Tab Notulensi: every reviewer of the candidate adds minutes; only the
 * author edits or deletes their own (CandidateNotePolicy, web actions).
 */
class NoteController extends Controller
{
    /**
     * POST /hiring/kandidat/{candidate}/notulensi {body}
     */
    public function store(NoteRequest $request, Candidate $candidate, #[CurrentUser] User $user, SaveCandidateNote $save): JsonResponse
    {
        Gate::authorize('note', $candidate);

        $note = $save->handle($user, $candidate, null, $request->string('body')->toString());

        return response()->json(['message' => 'Notulensi ditambahkan.', 'note' => $this->note($note, $user)], 201);
    }

    /**
     * PATCH /hiring/notulensi/{note} {body}
     */
    public function update(NoteRequest $request, CandidateNote $note, #[CurrentUser] User $user, SaveCandidateNote $save): JsonResponse
    {
        Gate::authorize('update', $note);

        $note = $save->handle($user, $note->candidate, $note, $request->string('body')->toString());

        return response()->json(['message' => 'Notulensi disimpan.', 'note' => $this->note($note, $user)]);
    }

    /**
     * DELETE /hiring/notulensi/{note}
     */
    public function destroy(CandidateNote $note, DeleteCandidateNote $delete): Response
    {
        Gate::authorize('delete', $note);

        $delete->handle($note);

        return response()->noContent();
    }

    /**
     * One entry in the shape of CandidateDetail `notes[]`.
     *
     * @return array<string, mixed>
     */
    private function note(CandidateNote $note, User $viewer): array
    {
        $note->loadMissing('author.position:id,name');
        $author = $note->author;

        return [
            'id' => $note->id,
            'body' => $note->body,
            'author' => $author === null ? null : [
                'id' => $author->id,
                'name' => $author->name,
                'avatar' => $author->avatar_url,
                'position' => $author->position?->name,
            ],
            'created_at' => $note->created_at?->toIso8601String(),
            'edited_at' => $note->edited_at?->toIso8601String(),
            'can_edit' => $note->author_id === $viewer->id,
        ];
    }
}
