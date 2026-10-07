<?php

namespace App\Http\Controllers\Meetings;

use App\Domain\Meetings\Actions\CancelMeeting;
use App\Domain\Meetings\Actions\ScheduleMeeting;
use App\Domain\Meetings\Actions\UpdateMeeting;
use App\Domain\Meetings\Actions\UpdateRsvp;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Queries\AgendaQuery;
use App\Domain\Meetings\Queries\EditableWorkspaces;
use App\Domain\Meetings\Queries\FindConflicts;
use App\Domain\Meetings\Queries\MeetingFeed;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meetings\ConflictsRequest;
use App\Http\Requests\Meetings\OccurrenceRequest;
use App\Http\Requests\Meetings\RsvpRequest;
use App\Http\Requests\Meetings\SaveMeetingRequest;
use App\Http\Resources\Meetings\MeetingPresenter;
use App\Http\Resources\Meetings\VideoPresenter;
use App\Models\Meeting;
use App\Models\User;
use App\Policies\MeetingPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /rapat (F2-3): agenda, schedule / edit form, detail with RSVP, cancel and
 * the conflict check of the form. Minutes live in MinutesController.
 */
class MeetingController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, AgendaQuery $agenda): Response
    {
        Gate::authorize('viewAny', Meeting::class);

        $week = $request->query('minggu');
        $day = is_string($week) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $week) === 1
            ? CarbonImmutable::parse($week, config()->string('app.office_timezone'))
            : null;

        return Inertia::render('meetings/index', [
            'agenda' => [...$agenda->forUser($user, $day), 'viewer_id' => $user->id],
        ]);
    }

    public function create(#[CurrentUser] User $user): Response
    {
        Gate::authorize('create', Meeting::class);

        return Inertia::render('meetings/create', ['form' => $this->formProps($user, null)]);
    }

    public function store(SaveMeetingRequest $request, #[CurrentUser] User $user, ScheduleMeeting $schedule): RedirectResponse
    {
        Gate::authorize('create', Meeting::class);

        $meeting = $schedule->handle($user, $request->toInput());
        $invited = $meeting->participants()->whereNotNull('user_id')->where('user_id', '!=', $user->id)->count();

        Inertia::flash('toast', ['type' => 'success', 'message' => "Undangan rapat terkirim ke {$invited} peserta."]);

        return redirect('/rapat/'.$meeting->id);
    }

    public function show(
        OccurrenceRequest $request,
        Meeting $meeting,
        #[CurrentUser] User $user,
        MeetingOccurrences $occurrences,
        MinutesStore $store,
        MeetingPresenter $presenter,
        MeetingFeed $feed,
        MeetingPolicy $policy,
    ): Response {
        Gate::authorize('view', $meeting);

        $meeting->load(['participants', 'workspace:id,key,name']);
        $occurrence = $occurrences->resolve($meeting, $request->occurrenceDate());

        return Inertia::render('meetings/show', [
            // Lazy: the 30 s `only: ['video']` poll skips it (audit 2026-10 §4).
            'detail' => fn (): array => [
                'viewer_id' => $user->id,
                'meeting' => $presenter->meeting($occurrence, $store->find($occurrence)),
                'people' => $feed->people([$occurrence], [], [$user->id]),
                'can' => [
                    'update' => $policy->update($user, $meeting)->allowed(),
                    'respond' => $policy->respond($user, $meeting)->allowed(),
                    'write_minutes' => $policy->canWriteMinutes($user, $meeting),
                ],
            ],
            // Video RuangKerja: join window, live count (partial reloads poll this).
            'video' => $meeting->platform === MeetingPlatform::Video
                ? fn (): array => app(VideoPresenter::class)->summary($occurrence, $user)
                : null,
        ]);
    }

    public function edit(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user): Response
    {
        Gate::authorize('update', $meeting);

        $meeting->load('participants');

        return Inertia::render('meetings/create', ['form' => $this->formProps($user, $meeting)]);
    }

    public function update(SaveMeetingRequest $request, Meeting $meeting, #[CurrentUser] User $user, UpdateMeeting $update): RedirectResponse
    {
        Gate::authorize('update', $meeting);

        $update->handle($meeting, $user, $request->toInput());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Perubahan rapat disimpan.']);

        return redirect('/rapat/'.$meeting->id);
    }

    public function destroy(OccurrenceRequest $request, Meeting $meeting, #[CurrentUser] User $user, CancelMeeting $cancel): RedirectResponse
    {
        Gate::authorize('cancel', $meeting);

        $cancel->handle($meeting, $user);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Rapat dibatalkan. Peserta sudah diberi tahu.']);

        return redirect('/rapat/'.$meeting->id);
    }

    public function rsvp(RsvpRequest $request, Meeting $meeting, #[CurrentUser] User $user, UpdateRsvp $rsvp): JsonResponse
    {
        Gate::authorize('respond', $meeting);

        $participant = $rsvp->handle($meeting, $user, $request->rsvp());

        return response()->json(['rsvp' => $participant->rsvp->value]);
    }

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

    /**
     * @return array<string, mixed>
     */
    private function formProps(User $user, ?Meeting $meeting): array
    {
        $people = User::query()
            ->where('company_id', $user->company_id)
            ->where('status', UserStatus::Active->value)
            ->with(['position:id,name', 'division:id,name'])
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_url', 'position_id', 'division_id']);

        $workspaces = app(EditableWorkspaces::class)->for($user);

        return [
            'viewer_id' => $user->id,
            'people' => MeetingPresenter::people($people),
            'workspaces' => $workspaces,
            'can_lead' => $user->hasPermission(Permission::DashboardViewCompany),
            'durations' => SaveMeetingRequest::DURATIONS,
            // "Video RuangKerja" is offered only when LiveKit is configured.
            'video_enabled' => app(VideoRooms::class)->configured(),
            'meeting' => $meeting !== null ? $this->values($meeting) : null,
        ];
    }

    /**
     * Current values of a meeting for the edit form.
     *
     * @return array<string, mixed>
     */
    private function values(Meeting $meeting): array
    {
        $timezone = config()->string('app.office_timezone');
        $start = $meeting->starts_at->setTimezone($timezone);

        return [
            'id' => $meeting->id,
            'title' => $meeting->title,
            'date' => $start->toDateString(),
            'start' => $start->format('H:i'),
            'duration' => $meeting->durationMinutes(),
            'platform' => $meeting->platform->value,
            'join_url' => $meeting->join_url,
            'location' => $meeting->location,
            'participants' => [
                ...$meeting->participants->whereNotNull('user_id')->pluck('user_id')->all(),
                ...$meeting->participants->whereNotNull('email')->pluck('email')->all(),
            ],
            'agenda' => $meeting->agenda === [] ? [''] : $meeting->agenda,
            'recurrence' => $meeting->recurrence->value,
            'recurrence_until' => $meeting->recurrence_until?->toDateString(),
            'reminders' => $meeting->reminders,
            'minute_taker_id' => $meeting->minute_taker_id,
            'workspace_id' => $meeting->workspace_id,
            'leadership' => $meeting->leadership,
        ];
    }
}
