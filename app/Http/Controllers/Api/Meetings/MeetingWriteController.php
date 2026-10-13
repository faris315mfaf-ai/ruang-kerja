<?php

namespace App\Http\Controllers\Api\Meetings;

use App\Domain\Meetings\Actions\CancelMeeting;
use App\Domain\Meetings\Actions\ScheduleMeeting;
use App\Domain\Meetings\Actions\UpdateMeeting;
use App\Domain\Meetings\Queries\EditableWorkspaces;
use App\Domain\Meetings\Queries\FindConflicts;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Meetings\Transcripts\Queries\NotulenSummary;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Search\Support\LikePattern;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\ConflictsRequest;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Meetings\SaveMeetingRequest;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Models\Meeting;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Schedule, change and cancel meetings from the mobile app (B4-B). Same
 * FormRequest (SaveMeetingRequest / ConflictsRequest), Actions
 * (ScheduleMeeting / UpdateMeeting / CancelMeeting) and MeetingPolicy as the
 * web form, so validation messages, series semantics (a change applies to
 * the whole series) and the invitation / change / cancel notifications are
 * identical. Writes answer with the same body as GET /api/v1/rapat/{id}
 * plus a message.
 */
class MeetingWriteController extends Controller
{
    public const int PEOPLE_LIMIT = 50;

    /**
     * GET /rapat/formulir[?rapat={id}] — what the schedule / edit form needs
     * (people = every active employee of the company, like the web form).
     */
    public function form(Request $request, #[CurrentUser] User $user, VideoRooms $rooms, NotulenConfig $notulen, NotulenSummary $summary): JsonResponse
    {
        Gate::authorize('create', Meeting::class);

        $meeting = null;
        $id = $request->query('rapat');

        if (is_string($id) && $id !== '') {
            $meeting = Meeting::query()->whereKey($id)->first();
            abort_if($meeting === null || Gate::denies('view', $meeting), 404);
            Gate::authorize('update', $meeting);
            $meeting->load('participants');
        }

        return response()->json([
            'viewer_id' => $user->id,
            'people' => MeetingPresenter::people($this->peopleQuery($user)->get(['id', 'name', 'avatar_url', 'position_id', 'division_id'])),
            'workspaces' => app(EditableWorkspaces::class)->for($user),
            'can_lead' => $user->hasPermission(Permission::DashboardViewCompany),
            'durations' => SaveMeetingRequest::DURATIONS,
            'reminders' => SaveMeetingRequest::REMINDERS,
            'platforms' => ['meet', 'zoom', 'room', 'client', 'video'],
            'recurrences' => ['none', 'weekdays', 'weekly', 'mon_wed_fri'],
            'video_enabled' => $rooms->configured(),
            'auto_minutes_enabled' => $notulen->configured(),
            'auto_minutes_notice' => $summary->notice(),
            'auto_minutes_notice_points' => $summary->noticePoints(),
            'meeting' => $meeting !== null ? $this->values($meeting) : null,
        ]);
    }

    /** GET /rapat/peserta?q= — people picker (same set as the form, max 50). */
    public function people(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('create', Meeting::class);

        $request->validate(['q' => ['nullable', 'string', 'max:100']], ['q.max' => 'Kata kunci maksimal :max karakter.']);
        $term = trim($request->string('q')->toString());

        $people = $this->peopleQuery($user)
            ->when($term !== '', function (Builder $query) use ($term): void {
                $pattern = LikePattern::contains($term);
                $query->where(fn (Builder $match) => $match->where('name', 'ilike', $pattern)->orWhere('email', 'ilike', $pattern));
            })
            ->limit(self::PEOPLE_LIMIT)
            ->get(['id', 'name', 'avatar_url', 'position_id', 'division_id']);

        return response()->json(['people' => MeetingPresenter::people($people)]);
    }

    /** GET /rapat/bentrok?peserta[]=&tanggal=&mulai=&durasi=&abaikan= — FindConflicts (web). */
    public function conflicts(ConflictsRequest $request, #[CurrentUser] User $user, FindConflicts $conflicts): JsonResponse
    {
        Gate::authorize('create', Meeting::class);

        $ignore = $request->input('abaikan');

        return response()->json($conflicts->handle(
            $user,
            $request->userIds(),
            $request->startsAt(),
            $request->endsAt(),
            is_string($ignore) && $ignore !== '' ? $ignore : null,
        ));
    }

    public function store(SaveMeetingRequest $request, #[CurrentUser] User $user, ScheduleMeeting $schedule): JsonResponse
    {
        Gate::authorize('create', Meeting::class);

        $meeting = $schedule->handle($user, $request->toInput());
        $invited = $meeting->participants()->whereNotNull('user_id')->where('user_id', '!=', $user->id)->count();

        return $this->detail($meeting, "Undangan rapat terkirim ke {$invited} peserta.", 201, ['invited' => $invited]);
    }

    public function update(SaveMeetingRequest $request, Meeting $meeting, #[CurrentUser] User $user, UpdateMeeting $update): JsonResponse
    {
        Gate::authorize('update', $meeting);

        $update->handle($meeting, $user, $request->toInput());

        return $this->detail($meeting->refresh(), 'Perubahan rapat disimpan.');
    }

    /** POST /rapat/{id}/batal (or DELETE /rapat/{id}): cancels the meeting / whole series. */
    public function cancel(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, CancelMeeting $cancel): JsonResponse
    {
        Gate::authorize('cancel', $meeting);

        $cancel->handle($meeting, $user);

        return $this->detail($meeting->refresh(), 'Rapat dibatalkan. Peserta sudah diberi tahu.');
    }

    /**
     * Same body as GET /api/v1/rapat/{id} (first occurrence) + message.
     *
     * @param  array<string, mixed>  $extra
     */
    private function detail(Meeting $meeting, string $message, int $status = 200, array $extra = []): JsonResponse
    {
        /** @var JsonResponse $show */
        $show = app()->call([app(MeetingController::class), 'show'], ['meeting' => $meeting]);
        /** @var array<string, mixed> $body */
        $body = $show->getData(true);
        $notulen = app(NotulenSummary::class);

        return response()->json([
            'message' => $message,
            ...$extra,
            ...$body,
            'auto_minutes_notice' => $meeting->auto_minutes ? $notulen->notice() : null,
        ], $status);
    }

    /**
     * @return Builder<User>
     */
    private function peopleQuery(User $user): Builder
    {
        return User::query()
            ->where('company_id', $user->company_id)
            ->where('status', UserStatus::Active->value)
            ->with(['position:id,name', 'division:id,name'])
            ->orderBy('name')
            ->orderBy('id');
    }

    /**
     * Current values of a meeting for the edit form (= web MeetingController).
     *
     * @return array<string, mixed>
     */
    private function values(Meeting $meeting): array
    {
        $start = $meeting->starts_at->setTimezone(config()->string('app.office_timezone'));

        return [
            'id' => $meeting->id,
            'title' => $meeting->title,
            'description' => $meeting->description,
            'date' => $start->toDateString(),
            'start' => $start->format('H:i'),
            'duration' => $meeting->durationMinutes(),
            'platform' => $meeting->platform->value,
            'join_url' => $meeting->join_url,
            'location' => $meeting->location,
            'participant_ids' => array_values($meeting->participants->whereNotNull('user_id')->pluck('user_id')->all()),
            'guest_emails' => array_values($meeting->participants->whereNotNull('email')->pluck('email')->all()),
            'agenda' => $meeting->agenda === [] ? [''] : $meeting->agenda,
            'recurrence' => $meeting->recurrence->value,
            'recurrence_until' => $meeting->recurrence_until?->toDateString(),
            'reminders' => $meeting->reminders,
            'minute_taker_id' => $meeting->minute_taker_id,
            'workspace_id' => $meeting->workspace_id,
            'leadership' => $meeting->leadership,
            'auto_minutes' => $meeting->auto_minutes,
        ];
    }
}
