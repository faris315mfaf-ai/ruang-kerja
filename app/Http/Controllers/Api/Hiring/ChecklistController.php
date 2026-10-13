<?php

namespace App\Http\Controllers\Api\Hiring;

use App\Domain\Hiring\Actions\AddChecklistItem;
use App\Domain\Hiring\Actions\DeleteChecklistItem;
use App\Domain\Hiring\Actions\SetChecklistItem;
use App\Domain\Hiring\Services\HiringAccess;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\ChecklistRequest;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * Tab Checklist: every reviewer ticks only their own items (HR items = any
 * HR), HR adds items for HR or one of the position's reviewers and removes
 * unticked ones (CandidateChecklistItemPolicy, web actions).
 */
class ChecklistController extends Controller
{
    public function __construct(private readonly HiringAccess $access) {}

    /**
     * POST /hiring/kandidat/{candidate}/checklist {label, reviewer_id|null, required?}
     */
    public function store(ChecklistRequest $request, Candidate $candidate, #[CurrentUser] User $user, AddChecklistItem $add): JsonResponse
    {
        Gate::authorize('manage', $candidate);

        $item = $add->handle(
            $user,
            $candidate,
            $request->string('label')->toString(),
            $request->filled('reviewer_id') ? $request->string('reviewer_id')->toString() : null,
            $request->boolean('required', true),
        );

        return response()->json(['message' => 'Butir checklist ditambahkan.', 'item' => $this->item($item, $user)], 201);
    }

    /**
     * PATCH /hiring/checklist/{item} {checked, note?}
     */
    public function update(ChecklistRequest $request, CandidateChecklistItem $item, #[CurrentUser] User $user, SetChecklistItem $set): JsonResponse
    {
        Gate::authorize('check', $item);

        $item = $set->handle($user, $item, $request->boolean('checked'), $request->filled('note') ? $request->string('note')->toString() : null);

        return response()->json(['item' => $this->item($item, $user)]);
    }

    /**
     * DELETE /hiring/checklist/{item}
     */
    public function destroy(CandidateChecklistItem $item, DeleteChecklistItem $delete): Response
    {
        Gate::authorize('delete', $item);

        $delete->handle($item);

        return response()->noContent();
    }

    /**
     * One row in the shape of CandidateDetail `checklist[]`.
     *
     * @return array<string, mixed>
     */
    private function item(CandidateChecklistItem $item, User $viewer): array
    {
        $item->loadMissing(['candidate', 'reviewer.position:id,name', 'checker.position:id,name']);
        $manager = $this->access->isManager($viewer);
        $person = fn (?User $user): ?array => $user === null ? null : [
            'id' => $user->id,
            'name' => $user->name,
            'avatar' => $user->avatar_url,
            'position' => $user->position?->name,
        ];

        return [
            'id' => $item->id,
            'label' => $item->label,
            'role' => $item->role->value,
            'role_label' => $item->role->label(),
            'required' => $item->is_required,
            'reviewer' => $person($item->reviewer),
            'checked_at' => $item->checked_at?->toIso8601String(),
            'checked_by' => $person($item->checker),
            'note' => $item->note,
            'can_check' => ! $item->candidate->stage->isFinal()
                && ($item->reviewer_id === null ? $manager : $item->reviewer_id === $viewer->id),
            'can_delete' => $manager && ! $item->isChecked(),
            'mine' => $item->reviewer_id === null ? $manager : $item->reviewer_id === $viewer->id,
        ];
    }
}
