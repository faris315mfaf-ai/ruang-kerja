<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Transcripts\Actions\ConvertSuggestionToTask;
use App\Domain\Meetings\Transcripts\Actions\DiscardTranscriptDraft;
use App\Domain\Meetings\Transcripts\Actions\InsertTranscriptDraft;
use App\Domain\Meetings\Transcripts\Actions\ResummarizeTranscript;
use App\Domain\Meetings\Transcripts\Actions\SetAutoMinutes;
use App\Domain\Meetings\Transcripts\Actions\SetTranscriptConsent;
use App\Domain\Meetings\Transcripts\Exceptions\TranscriptConflict;
use App\Domain\Meetings\Transcripts\Queries\NotulenSummary;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Meetings\AutoMinutesToggleRequest;
use App\Http\Requests\Meetings\MeetingRequest;
use App\Http\Requests\Meetings\OccurrenceRequest;
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

/**
 * Notulen otomatis for the app (B4-B, docs/fitur/notulen-otomatis-kontrak.md):
 * status summary, the organizer's switch, each person's opt-out, the
 * transcript (segments only for invited people; every read audited
 * `meeting.transcript_viewed`, at most once per 10 minutes per reader, like
 * the web) and the minute taker's draft actions. Same Actions and
 * MeetingTranscriptPolicy abilities as the web NotulenController; conflicts
 * (no transcript yet, draft already inserted …) answer 409.
 */
class AutoMinutesController extends Controller
{
    public function __construct(
        private readonly MeetingOccurrences $occurrences,
        private readonly NotulenSummary $summary,
    ) {}

    /** GET …/notulen-otomatis?tanggal= — status summary (everyone who sees the meeting). */
    public function status(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('status', [MeetingTranscript::class, $meeting]);

        return $this->summaryResponse($this->occurrence($request, $meeting), $user);
    }

    /** PATCH …/notulen-otomatis {enabled} — organizer, video meetings only (whole series). */
    public function settings(AutoMinutesToggleRequest $request, Meeting $meeting, #[CurrentUser] User $user, SetAutoMinutes $set): JsonResponse
    {
        Gate::authorize('configure', [MeetingTranscript::class, $meeting]);

        $set->handle($meeting, $user, $request->boolean('enabled'));

        return $this->summaryResponse($this->occurrence($request, $meeting->refresh()), $user);
    }

    /** PUT …/transkrip/persetujuan {opted_out} — "Jangan transkrip suara saya" (whole series). */
    public function consent(TranscriptConsentRequest $request, Meeting $meeting, #[CurrentUser] User $user, SetTranscriptConsent $set): JsonResponse
    {
        Gate::authorize('consent', [MeetingTranscript::class, $meeting]);

        return response()->json(['opted_out' => $set->handle($meeting, $user, $request->boolean('opted_out'))]);
    }

    /**
     * GET …/transkrip?tanggal= — summary (status + draft for invited people)
     * and the segments when the viewer may read the transcript.
     */
    public function transcript(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('status', [MeetingTranscript::class, $meeting]);

        $occurrence = $this->occurrence($request, $meeting);
        $transcript = $this->find($occurrence);
        $segments = null;

        if ($transcript !== null && Gate::allows('view', [MeetingTranscript::class, $meeting])) {
            // Personal data: every reader is audited (at most once per 10 minutes per transcript).
            if (Cache::add('notulen:viewed:'.$user->id.':'.$transcript->id, true, 600)) {
                $audit->log('meeting.transcript_viewed', $transcript, null, null, $user);
            }

            $segments = NotulenSummary::segments($transcript);
        }

        return response()->json([
            'notulen' => $this->summary->summary($occurrence, $user, $transcript),
            'transkrip' => $segments,
        ])->header('Cache-Control', 'no-store');
    }

    /** POST …/transkrip/masukkan — put the AI draft into the minutes (once). */
    public function insert(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, InsertTranscriptDraft $insert): JsonResponse
    {
        Gate::authorize('manage', [MeetingTranscript::class, $meeting]);

        $occurrence = $this->occurrence($request, $meeting);

        return $this->guard(function () use ($occurrence, $user, $insert): JsonResponse {
            $result = $insert->handle($occurrence, $user, $this->findOrFail($occurrence));

            return response()->json([
                'message' => 'Draf dimasukkan ke notulen.',
                'occurrence_date' => $occurrence->date,
                'inserted_at' => $result['transcript']->inserted_at?->toIso8601ZuluString('millisecond'),
                'action_item_ids' => $result['action_item_ids'],
            ]);
        });
    }

    /** POST …/transkrip/buang — discard the AI draft. */
    public function discard(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, DiscardTranscriptDraft $discard): JsonResponse
    {
        Gate::authorize('manage', [MeetingTranscript::class, $meeting]);

        $occurrence = $this->occurrence($request, $meeting);

        return $this->guard(function () use ($occurrence, $user, $discard): JsonResponse {
            $transcript = $discard->handle($user, $this->findOrFail($occurrence));

            return $this->summaryResponse($occurrence, $user, $transcript);
        });
    }

    /** POST …/transkrip/ringkas-ulang — summarize again (failed / AI turned on later). */
    public function resummarize(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, ResummarizeTranscript $resummarize): JsonResponse
    {
        Gate::authorize('manage', [MeetingTranscript::class, $meeting]);

        $occurrence = $this->occurrence($request, $meeting);

        return $this->guard(function () use ($occurrence, $user, $resummarize): JsonResponse {
            $resummarize->handle($this->findOrFail($occurrence), $user);

            return $this->summaryResponse($occurrence, $user);
        });
    }

    /** POST …/transkrip/tindak-lanjut/{tl-n}/tugas {workspace_id?} — one AI suggestion → task. */
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
                'task' => $task !== null ? ['id' => $task->id, 'key' => $task->displayKey()] : null,
            ]);
        });
    }

    private function occurrence(MeetingRequest $request, Meeting $meeting): Occurrence
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
        return response()->json(['notulen' => $this->summary->summary($occurrence, $user, $transcript)])
            ->header('Cache-Control', 'no-store');
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
