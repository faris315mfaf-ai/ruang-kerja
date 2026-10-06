<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\ConvertActionItemsToTasks;
use App\Domain\Meetings\Actions\FinalizeMinutes;
use App\Domain\Meetings\Actions\RemindActionItemOwners;
use App\Domain\Meetings\Actions\RemoveActionItem;
use App\Domain\Meetings\Actions\ReopenMinutes;
use App\Domain\Meetings\Actions\SaveMinutes;
use App\Domain\Meetings\Actions\UpdateActionItem;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\EditableWorkspaces;
use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\MinutesStore;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\ActionItemRequest;
use App\Http\Requests\Meetings\ConvertActionItemsRequest;
use App\Http\Requests\Meetings\MeetingRequest;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Meetings\SaveMinutesRequest;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\MeetingPolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /rapat/{meeting}/notulen (F2-3): minutes of one occurrence (?tanggal= for a
 * series). The page is Inertia; autosave, finalize/reopen and follow-ups are
 * JSON endpoints that answer with the fresh minutes (or follow-up).
 */
class MinutesController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly MinutesStore $store,
        private readonly MeetingPresenter $presenter,
    ) {}

    public function show(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, MeetingFeed $feed, MeetingPolicy $policy): Response
    {
        Gate::authorize('view', $meeting);

        $occurrence = $this->occurrence($request, $meeting);
        $minutes = $this->fresh($occurrence);
        $workspaces = $meeting->workspace_id === null && $policy->canWriteMinutes($user, $meeting)
            ? app(EditableWorkspaces::class)->for($user)
            : [];

        return Inertia::render('meetings/minutes', [
            'record' => [
                'viewer_id' => $user->id,
                'meeting' => $this->presenter->meeting($occurrence, $minutes),
                'minutes' => $this->presenter->minutes($occurrence, $minutes),
                'people' => $feed->people([$occurrence], $minutes !== null ? [$minutes] : [], [$user->id]),
                'workspaces' => $workspaces,
                'can' => [
                    'edit' => $policy->canWriteMinutes($user, $meeting),
                    'reopen' => $policy->isOrganizer($user, $meeting),
                ],
            ],
        ]);
    }

    public function save(SaveMinutesRequest $request, Meeting $meeting, #[CurrentUser] User $user, SaveMinutes $save): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('editMinutes', [$meeting, $this->store->find($occurrence)]);

        $save->handle($occurrence, $user, $request->content());

        return $this->minutesResponse($occurrence);
    }

    public function finalize(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, FinalizeMinutes $finalize): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('editMinutes', [$meeting, $this->store->find($occurrence)]);

        $finalize->handle($occurrence, $user);

        return $this->minutesResponse($occurrence);
    }

    public function reopen(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, ReopenMinutes $reopen): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        $minutes = $this->store->find($occurrence);
        abort_if($minutes === null, 404);
        Gate::authorize('reopenMinutes', [$meeting, $minutes]);

        $reopen->handle($minutes, $user);

        return $this->minutesResponse($occurrence);
    }

    public function convert(ConvertActionItemsRequest $request, Meeting $meeting, #[CurrentUser] User $user, ConvertActionItemsToTasks $convert): JsonResponse
    {
        Gate::authorize('manageActionItems', $meeting);

        $occurrence = $this->occurrence($request, $meeting);
        $workspaceId = $request->input('workspace_id');
        $chosen = is_string($workspaceId) && $workspaceId !== ''
            ? Workspace::query()->where('company_id', $user->company_id)->find($workspaceId)
            : null;

        $tasks = $convert->handle($occurrence, $user, $request->itemIds(), $chosen);

        return $this->minutesResponse($occurrence, ['created' => count($tasks)]);
    }

    public function remind(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, RemindActionItemOwners $remind): JsonResponse
    {
        Gate::authorize('manageActionItems', $meeting);

        $reminded = $remind->handle($this->occurrence($request, $meeting), $user);

        return response()->json(['reminded' => $reminded]);
    }

    public function storeItem(ActionItemRequest $request, Meeting $meeting, #[CurrentUser] User $user, AddActionItem $add): JsonResponse
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

    public function updateItem(ActionItemRequest $request, Meeting $meeting, MeetingActionItem $item, #[CurrentUser] User $user, UpdateActionItem $update): JsonResponse
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

    public function destroyItem(ActionItemRequest $request, Meeting $meeting, MeetingActionItem $item, RemoveActionItem $remove): JsonResponse
    {
        Gate::authorize('editMinutes', [$meeting, $item->minutes]);

        $remove->handle($item);

        return response()->json(['deleted' => true]);
    }

    private function occurrence(MeetingRequest $request, Meeting $meeting): Occurrence
    {
        $meeting->loadMissing(['participants', 'workspace:id,key,name']);

        return $this->occurrences->resolve($meeting, $request->occurrenceDate());
    }

    private function fresh(Occurrence $occurrence): ?MeetingMinutes
    {
        return $this->store->find($occurrence)?->load('actionItems.task.workspace:id,key');
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function minutesResponse(Occurrence $occurrence, array $extra = []): JsonResponse
    {
        return response()->json([
            ...$extra,
            'minutes' => $this->presenter->minutes($occurrence, $this->fresh($occurrence)),
        ]);
    }
}
