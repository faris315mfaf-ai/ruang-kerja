<?php

namespace App\Http\Controllers\Notulen;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Queries\EditableWorkspaces;
use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Transcripts\Actions\ConvertSuggestionToTask;
use App\Domain\Meetings\Transcripts\Actions\DiscardTranscriptDraft;
use App\Domain\Meetings\Transcripts\Actions\InsertTranscriptDraft;
use App\Domain\Meetings\Transcripts\Actions\ResummarizeTranscript;
use App\Domain\Meetings\Transcripts\Actions\SetAutoMinutes;
use App\Domain\Meetings\Transcripts\Actions\SetTranscriptConsent;
use App\Domain\Meetings\Transcripts\Exceptions\TranscriptConflict;
use App\Domain\Meetings\Transcripts\Queries\NotulenSummary;
use App\Domain\Meetings\Transcripts\Services\TranscriptConsents;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Notulen\AutoMinutesRequest;
use App\Http\Requests\Notulen\SuggestionTaskRequest;
use App\Http\Requests\Notulen\TranscriptConsentRequest;
use App\Models\Meeting;
use App\Models\MeetingTranscript;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Notulen otomatis (docs/fitur/notulen-otomatis-kontrak.md §1): the review
 * page, status, transcript text (audited), the organizer's auto_minutes
 * switch, each person's opt-out, and the notulis's draft actions. Abilities:
 * MeetingTranscriptPolicy (invisible meeting → 404 in the FormRequest).
 */
class NotulenController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly NotulenSummary $summary,
    ) {}

    public function page(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, MeetingFeed $feed, EditableWorkspaces $workspaces): Response
    {
        Gate::authorize('view', [MeetingTranscript::class, $meeting]);

        $meeting->load(['participants', 'workspace:id,key,name']);
        $occurrence = $this->occurrence($request, $meeting);

        return Inertia::render('meetings/notulen-otomatis', [
            'meeting' => [
                'id' => $meeting->id,
                'title' => $meeting->title,
                'occurrence_date' => $occurrence->date,
                'starts_at' => $occurrence->startsAt->toIso8601ZuluString(),
                'ends_at' => $occurrence->endsAt->toIso8601ZuluString(),
                'href' => $occurrence->url(),
                'minutes_href' => '/rapat/'.$meeting->id.'/notulen?tanggal='.$occurrence->date,
                'agenda' => $meeting->agenda,
                'workspace' => $meeting->workspace !== null
                    ? ['id' => $meeting->workspace->id, 'key' => $meeting->workspace->key, 'name' => $meeting->workspace->name]
                    : null,
            ],
            'people' => $feed->people([$occurrence], [], [$user->id]),
            'notulen' => $this->summary->for($occurrence, $user),
            'workspaces' => fn (): array => $meeting->workspace_id === null ? $workspaces->for($user) : [],
        ]);
    }

    public function status(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('status', [MeetingTranscript::class, $meeting]);

        return $this->summaryResponse($this->occurrence($request, $meeting), $user);
    }

    public function transcript(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('view', [MeetingTranscript::class, $meeting]);

        $transcript = $this->find($this->occurrence($request, $meeting));

        if ($transcript === null) {
            return response()->json(['message' => 'Belum ada transkrip untuk rapat ini.'], 404);
        }

        // Personal data: every reader is audited (at most once per 10 minutes per transcript).
        if (Cache::add('notulen:viewed:'.$user->id.':'.$transcript->id, true, 600)) {
            $audit->log('meeting.transcript_viewed', $transcript, null, null, $user);
        }

        return response()->json(NotulenSummary::segments($transcript))->header('Cache-Control', 'no-store');
    }

    public function settings(AutoMinutesRequest $request, Meeting $meeting, #[CurrentUser] User $user, SetAutoMinutes $set): JsonResponse
    {
        Gate::authorize('configure', [MeetingTranscript::class, $meeting]);

        $set->handle($meeting, $user, $request->boolean('auto_minutes'));

        return $this->summaryResponse($this->occurrence($request, $meeting), $user);
    }

    public function consent(TranscriptConsentRequest $request, Meeting $meeting, #[CurrentUser] User $user, SetTranscriptConsent $set): JsonResponse
    {
        Gate::authorize('consent', [MeetingTranscript::class, $meeting]);

        $optedOut = $set->handle($meeting, $user, $request->boolean('opted_out'));

        return response()->json(['opted_out' => $optedOut, 'attributes' => TranscriptConsents::attributes($optedOut)]);
    }

    public function insert(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, InsertTranscriptDraft $insert): JsonResponse
    {
        Gate::authorize('manage', [MeetingTranscript::class, $meeting]);

        $occurrence = $this->occurrence($request, $meeting);

        return $this->guard(function () use ($occurrence, $user, $insert): JsonResponse {
            $result = $insert->handle($occurrence, $user, $this->findOrFail($occurrence));

            return response()->json([
                'minutes_href' => '/rapat/'.$occurrence->meeting->id.'/notulen?tanggal='.$occurrence->date,
                'inserted_at' => $result['transcript']->inserted_at?->toIso8601ZuluString('millisecond'),
                'action_item_ids' => $result['action_item_ids'],
            ]);
        });
    }

    public function discard(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, DiscardTranscriptDraft $discard): JsonResponse
    {
        Gate::authorize('manage', [MeetingTranscript::class, $meeting]);

        $occurrence = $this->occurrence($request, $meeting);

        return $this->guard(function () use ($occurrence, $user, $discard): JsonResponse {
            $transcript = $discard->handle($user, $this->findOrFail($occurrence));

            return $this->summaryResponse($occurrence, $user, $transcript);
        });
    }

    public function resummarize(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, ResummarizeTranscript $resummarize): JsonResponse
    {
        Gate::authorize('manage', [MeetingTranscript::class, $meeting]);

        $occurrence = $this->occurrence($request, $meeting);

        return $this->guard(function () use ($occurrence, $user, $resummarize): JsonResponse {
            $resummarize->handle($this->findOrFail($occurrence));

            return $this->summaryResponse($occurrence, $user);
        });
    }

    public function task(SuggestionTaskRequest $request, Meeting $meeting, string $suggestion, #[CurrentUser] User $user, ConvertSuggestionToTask $convert): JsonResponse
    {
        Gate::authorize('manage', [MeetingTranscript::class, $meeting]);

        $occurrence = $this->occurrence($request, $meeting);
        $workspaceId = $request->input('workspace_id');
        $chosen = is_string($workspaceId) && $workspaceId !== ''
            ? Workspace::query()->where('company_id', $user->company_id)->find($workspaceId)
            : null;

        return $this->guard(function () use ($occurrence, $user, $suggestion, $chosen, $convert): JsonResponse {
            $result = $convert->handle($occurrence, $user, $this->findOrFail($occurrence), $suggestion, $chosen);
            $task = $result['task'];

            return response()->json([
                'suggestion' => $result['suggestion'],
                'task' => $task !== null ? ['id' => $task->id, 'key' => $task->displayKey(), 'href' => $task->url()] : null,
            ]);
        });
    }

    private function occurrence(OccurrenceRequest|AutoMinutesRequest|TranscriptConsentRequest|SuggestionTaskRequest $request, Meeting $meeting): Occurrence
    {
        return $this->occurrences->resolveForMinutes($meeting, $request->occurrenceDate());
    }

    private function find(Occurrence $occurrence): ?MeetingTranscript
    {
        return MeetingTranscript::query()->forOccurrence($occurrence->meeting->id, $occurrence->date)->first();
    }

    private function findOrFail(Occurrence $occurrence): MeetingTranscript
    {
        return $this->find($occurrence) ?? throw new TranscriptConflict('Belum ada transkrip untuk rapat ini.');
    }

    private function summaryResponse(Occurrence $occurrence, User $user, ?MeetingTranscript $transcript = null): JsonResponse
    {
        return response()->json($this->summary->for($occurrence, $user, $transcript))->header('Cache-Control', 'no-store');
    }

    /**
     * @param  callable(): JsonResponse  $action
     */
    private function guard(callable $action): JsonResponse
    {
        try {
            return $action();
        } catch (TranscriptConflict $conflict) {
            return response()->json(['message' => $conflict->getMessage()], 409);
        }
    }
}
