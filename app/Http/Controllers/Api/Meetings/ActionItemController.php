<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\ConvertActionItemsToTasks;
use App\Domain\Meetings\Actions\RemindActionItemOwners;
use App\Domain\Meetings\Actions\RemoveActionItem;
use App\Domain\Meetings\Actions\UpdateActionItem;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\EditableWorkspaces;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\MinutesStore;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Meetings\ConvertActionItemRequest;
use App\Http\Requests\Meetings\ActionItemRequest;
use App\Http\Requests\Meetings\ConvertActionItemsRequest;
use App\Http\Requests\Meetings\MeetingRequest;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\MeetingPolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Follow-ups ("tindak lanjut") of one occurrence's minutes (B4-B): list,
 * add / change / tick / remove (web AddActionItem, UpdateActionItem,
 * RemoveActionItem), turn into tasks (ConvertActionItemsToTasks — one item
 * or several, idempotent: an item that already has a task is skipped) and
 * remind the owners (RemindActionItemOwners — at most once per day per
 * follow-up). Abilities as the web MinutesController: editMinutes,
 * completeActionItem (assignee may tick their own), manageActionItems.
 */
class ActionItemController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly MinutesStore $store,
        private readonly MeetingPresenter $presenter,
    ) {}

    public function index(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, MeetingPolicy $policy): JsonResponse
    {
        Gate::authorize('view', $meeting);

        $occurrence = $this->occurrence($request, $meeting);
        $minutes = $this->store->find($occurrence)?->load('actionItems.task.workspace:id,key');
        $canWrite = $policy->canWriteMinutes($user, $meeting);

        return response()->json([
            'occurrence_date' => $occurrence->date,
            'minutes_status' => $minutes?->status->value ?? 'draft',
            'items' => $minutes === null ? [] : $minutes->actionItems->map(fn (MeetingActionItem $item): array => MeetingPresenter::actionItem($item))->values()->all(),
            'workspace' => $meeting->workspace !== null
                ? ['id' => $meeting->workspace->id, 'key' => $meeting->workspace->key, 'name' => $meeting->workspace->name]
                : null,
            // Choose a target workspace only when the meeting has none.
            'workspaces' => $meeting->workspace_id === null && $canWrite ? app(EditableWorkspaces::class)->for($user) : [],
            'can' => [
                'edit' => $policy->editMinutes($user, $meeting, $minutes)->allowed(),
                'manage' => $policy->manageActionItems($user, $meeting)->allowed(),
            ],
        ]);
    }

    public function store(ActionItemRequest $request, Meeting $meeting, #[CurrentUser] User $user, AddActionItem $add): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('editMinutes', [$meeting, $this->store->find($occurrence)]);

        $fields = $request->fields();
        $item = $add->handle($occurrence, $user, [
            'text' => $fields['text'] ?? '',
            'assignee_id' => $fields['assignee_id'] ?? null,
            'due_date' => $fields['due_date'] ?? null,
        ]);

        return response()->json(['item' => MeetingPresenter::actionItem($item)], 201);
    }

    public function update(ActionItemRequest $request, Meeting $meeting, MeetingActionItem $item, #[CurrentUser] User $user, UpdateActionItem $update): JsonResponse
    {
        if ($request->onlyDone()) {
            Gate::authorize('completeActionItem', [$meeting, $item]);
        } else {
            Gate::authorize('editMinutes', [$meeting, $item->minutes]);
        }

        $item = $update->handle($item, $user, $request->fields());
        $item->load('task.workspace:id,key');

        return response()->json(['item' => MeetingPresenter::actionItem($item)]);
    }

    public function destroy(ActionItemRequest $request, Meeting $meeting, MeetingActionItem $item, RemoveActionItem $remove): JsonResponse
    {
        Gate::authorize('editMinutes', [$meeting, $item->minutes]);

        $remove->handle($item);

        return response()->json(['deleted' => true]);
    }

    /** POST …/tindak-lanjut/{item}/jadikan-tugas {workspace_id?} — idempotent. */
    public function convert(ConvertActionItemRequest $request, Meeting $meeting, MeetingActionItem $item, #[CurrentUser] User $user, ConvertActionItemsToTasks $convert): JsonResponse
    {
        Gate::authorize('manageActionItems', $meeting);

        $occurrence = $this->occurrences->resolveForMinutes($this->loaded($meeting), $item->minutes->occurrence_date->toDateString());
        $tasks = $convert->handle($occurrence, $user, [$item->id], $this->chosenWorkspace($request, $user));
        $item->refresh()->load('task.workspace:id,key');

        return response()->json([
            'created' => count($tasks),
            'item' => MeetingPresenter::actionItem($item),
        ]);
    }

    /** POST …/tindak-lanjut/jadikan-semua {item_ids[], workspace_id?} — web "Jadikan tugas" for several. */
    public function convertMany(ConvertActionItemsRequest $request, Meeting $meeting, #[CurrentUser] User $user, ConvertActionItemsToTasks $convert): JsonResponse
    {
        Gate::authorize('manageActionItems', $meeting);

        $occurrence = $this->occurrence($request, $meeting);
        $tasks = $convert->handle($occurrence, $user, $request->itemIds(), $this->chosenWorkspace($request, $user));
        $minutes = $this->store->find($occurrence)?->load('actionItems.task.workspace:id,key');

        return response()->json([
            'created' => count($tasks),
            'notulen' => $this->presenter->minutes($occurrence, $minutes),
        ]);
    }

    /** POST …/tindak-lanjut/ingatkan — open follow-ups' owners (once per day per follow-up). */
    public function remind(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, RemindActionItemOwners $remind): JsonResponse
    {
        Gate::authorize('manageActionItems', $meeting);

        $reminded = $remind->handle($this->occurrence($request, $meeting), $user);

        return response()->json([
            'reminded' => $reminded,
            'message' => $reminded === []
                ? 'Tidak ada penanggung jawab yang perlu diingatkan hari ini.'
                : 'Pengingat terkirim ke '.count($reminded).' penanggung jawab.',
        ]);
    }

    private function chosenWorkspace(Request $request, User $user): ?Workspace
    {
        $workspaceId = $request->input('workspace_id');

        return is_string($workspaceId) && $workspaceId !== ''
            ? Workspace::query()->where('company_id', $user->company_id)->find($workspaceId)
            : null;
    }

    private function loaded(Meeting $meeting): Meeting
    {
        return $meeting->loadMissing(['participants', 'workspace:id,key,name']);
    }

    private function occurrence(MeetingRequest $request, Meeting $meeting): Occurrence
    {
        return $this->occurrences->resolveForMinutes($this->loaded($meeting), $request->occurrenceDate());
    }
}
