<?php

use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
 * MeetingPolicy matrix. 'allow' · 'deny' (403) · 'hidden' (404).
 * Leadership meetings are also visible to dashboard.view_company (Direksi,
 * HR, Super Admin); nobody gets extra rights from a role otherwise.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->organizer = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->taker = User::factory()->withRole(Role::Anggota)->create();
    $this->participant = User::factory()->withRole(Role::Anggota)->create();
    $this->assignee = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->organizer)
        ->withParticipants([$this->taker, $this->participant, $this->assignee])
        ->create(['minute_taker_id' => $this->taker->id]);
    $this->leadership = Meeting::factory()->by($this->organizer)->leadership()
        ->withParticipants([$this->taker, $this->participant])
        ->create(['minute_taker_id' => $this->taker->id]);
});

function meetingActor(string $actor): User
{
    return match ($actor) {
        'organizer' => test()->organizer,
        'taker' => test()->taker,
        'participant' => test()->participant,
        'anggota' => User::factory()->withRole(Role::Anggota)->create(),
        'kadiv' => User::factory()->withRole(Role::KepalaDivisi)->create(),
        'hr' => User::factory()->withRole(Role::Hr)->create(),
        'direksi' => User::factory()->withRole(Role::Direksi)->create(),
        'super_admin' => User::factory()->withRole(Role::SuperAdmin)->create(),
        'foreign' => User::factory()->withRole(Role::Direksi)->create(['company_id' => Company::factory()->create()->id]),
        'inactive' => tap(test()->participant)->update(['status' => 'inactive']),
    };
}

dataset('meeting matrix', [
    // actor, view, update, respond, editMinutes, manageActionItems
    'organizer' => ['organizer', 'allow', 'allow', 'allow', 'allow', 'allow'],
    'minute taker' => ['taker', 'allow', 'deny', 'allow', 'allow', 'allow'],
    'participant' => ['participant', 'allow', 'deny', 'allow', 'deny', 'deny'],
    'other employee' => ['anggota', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'other kepala divisi' => ['kadiv', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'hr' => ['hr', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'direksi' => ['direksi', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'super admin' => ['super_admin', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'other company' => ['foreign', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
    'inactive participant' => ['inactive', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden'],
]);

it('authorizes a regular meeting', function (string $actor, string $view, string $update, string $respond, string $edit, string $manage) {
    $user = meetingActor($actor);
    $meeting = $this->meeting;

    expect([
        meetingVerdict($user, 'view', $meeting),
        meetingVerdict($user, 'update', $meeting),
        meetingVerdict($user, 'cancel', $meeting),
        meetingVerdict($user, 'respond', $meeting),
        meetingVerdict($user, 'editMinutes', [$meeting, null]),
        meetingVerdict($user, 'manageActionItems', $meeting),
    ])->toBe([$view, $update, $update, $respond, $edit, $manage]);
})->with('meeting matrix');

dataset('leadership matrix', [
    // actor, view, update, editMinutes
    'organizer' => ['organizer', 'allow', 'allow', 'allow'],
    'participant' => ['participant', 'allow', 'deny', 'deny'],
    'other employee' => ['anggota', 'hidden', 'hidden', 'hidden'],
    'kepala divisi' => ['kadiv', 'hidden', 'hidden', 'hidden'],
    'hr' => ['hr', 'allow', 'deny', 'deny'],
    'direksi' => ['direksi', 'allow', 'deny', 'deny'],
    'super admin' => ['super_admin', 'allow', 'deny', 'deny'],
    'direksi of another company' => ['foreign', 'hidden', 'hidden', 'hidden'],
]);

it('shows leadership meetings to dashboard.view_company, read-only', function (string $actor, string $view, string $update, string $edit) {
    $user = meetingActor($actor);

    expect([
        meetingVerdict($user, 'view', $this->leadership),
        meetingVerdict($user, 'update', $this->leadership),
        meetingVerdict($user, 'editMinutes', [$this->leadership, null]),
    ])->toBe([$view, $update, $edit]);
})->with('leadership matrix');

it('locks final minutes: only the organizer reopens', function () {
    $minutes = MeetingMinutes::query()->create([
        'meeting_id' => $this->meeting->id,
        'occurrence_date' => $this->meeting->firstDate(),
        'status' => 'final',
        'finalized_at' => now(),
    ]);

    expect(meetingVerdict($this->organizer, 'editMinutes', [$this->meeting, $minutes]))->toBe('deny')
        ->and(meetingVerdict($this->taker, 'editMinutes', [$this->meeting, $minutes]))->toBe('deny')
        ->and(meetingVerdict($this->organizer, 'reopenMinutes', [$this->meeting, $minutes]))->toBe('allow')
        ->and(meetingVerdict($this->taker, 'reopenMinutes', [$this->meeting, $minutes]))->toBe('deny')
        ->and(meetingVerdict($this->participant, 'reopenMinutes', [$this->meeting, $minutes]))->toBe('deny')
        ->and(meetingVerdict(meetingActor('direksi'), 'reopenMinutes', [$this->meeting, $minutes]))->toBe('hidden');
});

it('lets the assignee tick off their follow-up, not other participants', function () {
    $minutes = MeetingMinutes::query()->create(['meeting_id' => $this->meeting->id, 'occurrence_date' => $this->meeting->firstDate()]);
    $item = MeetingActionItem::query()->create(['minutes_id' => $minutes->id, 'text' => 'Kirim jadwal', 'assignee_id' => $this->assignee->id]);

    expect(meetingVerdict($this->assignee, 'completeActionItem', [$this->meeting, $item]))->toBe('allow')
        ->and(meetingVerdict($this->taker, 'completeActionItem', [$this->meeting, $item]))->toBe('allow')
        ->and(meetingVerdict($this->participant, 'completeActionItem', [$this->meeting, $item]))->toBe('deny');
});

it('refuses changes to a canceled meeting', function () {
    $this->meeting->update(['canceled_at' => now()]);

    expect(meetingVerdict($this->organizer, 'view', $this->meeting))->toBe('allow')
        ->and(meetingVerdict($this->organizer, 'update', $this->meeting))->toBe('deny')
        ->and(meetingVerdict($this->participant, 'respond', $this->meeting))->toBe('deny');
});

it('lists exactly the meetings the policy lets a user see', function (string $actor) {
    $user = meetingActor($actor);
    Meeting::factory()->create();
    Meeting::factory()->by(User::factory()->create())->leadership()->create();
    Meeting::factory()->by($this->organizer)->withParticipants([$this->participant], Rsvp::No)->create();

    $listed = Meeting::query()->visibleTo($user)->pluck('id')->sort()->values()->all();
    $allowed = Meeting::query()->get()->filter(fn (Meeting $meeting): bool => Gate::forUser($user)->allows('view', $meeting))
        ->pluck('id')->sort()->values()->all();

    expect($listed)->toBe($allowed);
})->with(['organizer', 'taker', 'participant', 'anggota', 'hr', 'direksi', 'super_admin', 'foreign', 'inactive']);
