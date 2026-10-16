<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Actions\ChooseMinutesSource;
use App\Domain\Meetings\Actions\FinalizeMinutes;
use App\Domain\Meetings\Actions\ReopenMinutes;
use App\Domain\Meetings\Actions\SaveMinutes;
use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\PreviousMinutes;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\MinutesEditing;
use App\Domain\Meetings\Services\MinutesStore;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\ChooseMinutesSourceRequest;
use App\Http\Requests\Meetings\MeetingRequest;
use App\Http\Requests\Meetings\MinutesEditingRequest;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Meetings\SaveMinutesRequest;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Http\Resources\Meetings\RoomPresenter;
use App\Models\Meeting;
use App\Models\MeetingMinutes;
use App\Models\MeetingMinuteVersion;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Write the minutes of one occurrence from the mobile app (B4-B): autosave
 * (SaveMinutes: one version per author per five minutes), finalize (422
 * with the list of problems when incomplete), reopen (organizer), the
 * version history (read-only; restoring is not on the web either), the
 * "X sedang menyunting" heartbeat and the notes source chosen before the
 * video meeting. Same FormRequests, Actions and MeetingPolicy abilities as
 * the web MinutesController / MeetingRoomController. Every answer carries
 * `notulen` = MeetingPresenter::minutes (same shape as GET …/notulen).
 */
class MinutesWriteController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly MinutesStore $store,
        private readonly MeetingPresenter $presenter,
    ) {}

    public function save(SaveMinutesRequest $request, Meeting $meeting, #[CurrentUser] User $user, SaveMinutes $save): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('editMinutes', [$meeting, $this->store->find($occurrence)]);

        $content = $request->content();

        if ($request->attendanceOnly()) {
            $current = $this->store->find($occurrence)?->content() ?? $this->store->blank($occurrence);
            $content = ['attendance' => $content['attendance'], 'sections' => $current['sections'], 'decisions' => $current['decisions']];
        }

        $save->handle($occurrence, $user, $content);

        return $this->minutesResponse($occurrence);
    }

    public function finalize(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, FinalizeMinutes $finalize): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('editMinutes', [$meeting, $this->store->find($occurrence)]);

        $finalize->handle($occurrence, $user);

        return $this->minutesResponse($occurrence, ['message' => 'Notulen final dan dibagikan ke peserta.']);
    }

    public function reopen(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, ReopenMinutes $reopen): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        $minutes = $this->store->find($occurrence);
        abort_if($minutes === null, 404, 'Notulen belum dimulai.');
        Gate::authorize('reopenMinutes', [$meeting, $minutes]);

        $reopen->handle($minutes, $user);

        return $this->minutesResponse($occurrence, ['message' => 'Notulen dibuka kembali sebagai draf.']);
    }

    /** GET …/notulen/versi — snapshots, newest first (anyone who may read the minutes). */
    public function versions(OccurrenceRequest $request, Meeting $meeting): JsonResponse
    {
        Gate::authorize('view', $meeting);

        $occurrence = $this->occurrence($request, $meeting);
        $minutes = $this->store->find($occurrence);
        $versions = $minutes === null ? collect() : MeetingMinuteVersion::query()
            ->where('minutes_id', $minutes->id)
            ->latest('created_at')
            ->latest('id')
            ->get(['id', 'minutes_id', 'created_by', 'created_at', 'updated_at']);
        $names = User::query()->whereIn('id', $versions->pluck('created_by')->filter()->unique()->values())->pluck('name', 'id');

        return response()->json([
            'minutes_id' => $minutes?->id,
            'occurrence_date' => $occurrence->date,
            'status' => $minutes?->status->value ?? 'draft',
            'versions' => $versions->values()->map(fn (MeetingMinuteVersion $version, int $index): array => [
                'id' => $version->id,
                'number' => $versions->count() - $index,
                'created_by' => $version->created_by !== null
                    ? ['id' => $version->created_by, 'name' => $names[$version->created_by] ?? null]
                    : null,
                'created_at' => $version->created_at?->toIso8601ZuluString(),
                'updated_at' => $version->updated_at?->toIso8601ZuluString(),
            ])->all(),
        ]);
    }

    /** GET …/notulen/versi/{version} — the content of one snapshot. */
    public function version(OccurrenceRequest $request, Meeting $meeting, string $version): JsonResponse
    {
        Gate::authorize('view', $meeting);

        $minutes = $this->store->find($this->occurrence($request, $meeting));
        $record = $minutes === null ? null : MeetingMinuteVersion::query()->where('minutes_id', $minutes->id)->whereKey($version)->first();
        abort_if($record === null, 404);

        $content = $record->content;
        $names = User::query()->whereKey($record->created_by)->pluck('name', 'id');

        return response()->json([
            'version' => [
                'id' => $record->id,
                'created_by' => $record->created_by !== null ? ['id' => $record->created_by, 'name' => $names[$record->created_by] ?? null] : null,
                'created_at' => $record->created_at?->toIso8601ZuluString(),
                'updated_at' => $record->updated_at?->toIso8601ZuluString(),
                'attendance' => array_values((array) ($content['attendance'] ?? [])),
                'sections' => array_map(
                    fn (mixed $section): array => [
                        'title' => is_array($section) ? (string) ($section['title'] ?? '') : '',
                        'body' => is_array($section) ? (string) ($section['body'] ?? '') : '',
                    ],
                    array_values((array) ($content['sections'] ?? [])),
                ),
                'decisions' => array_values(array_map(strval(...), (array) ($content['decisions'] ?? []))),
            ],
        ]);
    }

    /** POST …/notulen/menyunting {active} — "X sedang menyunting" heartbeat (autosave mode). */
    public function editing(MinutesEditingRequest $request, Meeting $meeting, #[CurrentUser] User $user, MinutesEditing $editing): JsonResponse
    {
        $occurrence = $this->occurrence($request, $meeting);
        Gate::authorize('editMinutes', [$meeting, $this->store->find($occurrence)]);

        return response()->json(['editing' => $editing->heartbeat($occurrence, $user, $request->boolean('active'))]);
    }

    /** POST …/sumber-notulen {source: continue|template|blank} — chosen once per occurrence (video meetings). */
    public function source(ChooseMinutesSourceRequest $request, Meeting $meeting, #[CurrentUser] User $user, ChooseMinutesSource $choose, PreviousMinutes $previous, RoomPresenter $room): JsonResponse
    {
        Gate::authorize('openVideo', $meeting);
        $meeting->loadMissing(['participants', 'workspace:id,key,name']);
        $occurrence = $this->occurrences->resolve($meeting, $request->occurrenceDate());
        Gate::authorize('editMinutes', [$meeting, $this->store->find($occurrence)]);

        $result = $choose->handle($occurrence, $user, $request->source());
        $minutes = $result['minutes']->fresh() ?? $result['minutes'];
        $minutes->load('actionItems.task.workspace:id,key');

        return response()->json([
            'applied' => $result['applied'],
            'notes_source' => $room->notesSource($occurrence, $minutes, $previous->for($occurrence), false),
            'notulen' => $this->presenter->minutes($occurrence, $minutes),
        ]);
    }

    private function occurrence(MeetingRequest $request, Meeting $meeting): Occurrence
    {
        $meeting->loadMissing(['participants', 'workspace:id,key,name']);

        return $this->occurrences->resolveForMinutes($meeting, $request->occurrenceDate());
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function minutesResponse(Occurrence $occurrence, array $extra = []): JsonResponse
    {
        $minutes = $this->store->find($occurrence)?->load('actionItems.task.workspace:id,key');

        return response()->json([
            ...$extra,
            'notulen' => $this->presenter->minutes($occurrence, $minutes instanceof MeetingMinutes ? $minutes : null),
        ]);
    }
}
