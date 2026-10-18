<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Actions\StoreMinutesDocument;
use App\Domain\Meetings\Services\MinutesDocument;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Tenancy\CompanyContext;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notes\CollabStateRequest;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Internal endpoints of the collab server for the collaborative room
 * minutes (document "meeting-minutes.{id}", MinutesCollab): load the stored
 * state (or a document built from the structured minutes) and store a new
 * one. VerifyCollabSecret, outside the web group; the collab server checked
 * the user's token on connect.
 */
class MinutesCollabStateController extends Controller
{
    /** GET /internal/rapat/notulen/{minutes}/state */
    public function show(string $minutes): JsonResponse
    {
        $model = MeetingMinutes::query()->with('meeting:id,company_id')->findOrFail($minutes);
        // Collab server (no user): run in the meeting's company (Fase 1 CompanyContext).
        app(CompanyContext::class)->set($model->meeting->company_id);
        $state = $model->doc_state;

        return response()->json([
            'id' => $model->id,
            'title' => null,
            'yjs_state' => $state === null ? null : base64_encode($state),
            'content' => $model->doc_content ?? MinutesDocument::toDoc($model->sections, $model->decisions),
        ]);
    }

    /** POST /internal/rapat/notulen/{minutes}/state */
    public function store(CollabStateRequest $request, string $minutes, StoreMinutesDocument $store): JsonResponse
    {
        $model = MeetingMinutes::query()->with('meeting:id,company_id')->findOrFail($minutes);
        app(CompanyContext::class)->set($model->meeting->company_id);
        $state = base64_decode($request->string('yjs_state')->toString(), true);

        abort_if($state === false, 422, 'yjs_state bukan base64.');

        /** @var list<string> $editorIds */
        $editorIds = array_values($request->array('editor_ids'));
        // The last person who edited before this store is the "updated by".
        $editor = $editorIds === [] ? null : User::query()
            ->whereIn('id', $editorIds)
            ->where('company_id', $model->meeting->company_id)
            ->where('status', UserStatus::Active)
            ->get()
            ->sortBy(fn (User $user): int => (int) array_search($user->id, $editorIds, true))
            ->last();

        /** @var array<mixed>|null $body */
        $body = $request->input('body');
        $changed = $store->handle($model, $state, $body, $editor);

        return response()->json(['stored' => true, 'changed' => $changed]);
    }
}
