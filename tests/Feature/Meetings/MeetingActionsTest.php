<?php

use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\CancelMeeting;
use App\Domain\Meetings\Actions\ConvertActionItemsToTasks;
use App\Domain\Meetings\Actions\FinalizeMinutes;
use App\Domain\Meetings\Actions\RemindActionItemOwners;
use App\Domain\Meetings\Actions\RemoveActionItem;
use App\Domain\Meetings\Actions\ReopenMinutes;
use App\Domain\Meetings\Actions\SaveMinutes;
use App\Domain\Meetings\Actions\ScheduleMeeting;
use App\Domain\Meetings\Actions\UpdateActionItem;
use App\Domain\Meetings\Actions\UpdateMeeting;
use App\Domain\Meetings\Actions\UpdateRsvp;
use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Enums\MinutesStatus;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Notifications\ActionItemDueNotification;
use App\Domain\Meetings\Notifications\MeetingInvitedNotification;
use App\Domain\Meetings\Notifications\MinutesFinalizedNotification;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingMinuteVersion;
use App\Models\MeetingParticipant;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

require_once __DIR__.'/../../Support/meeting-helpers.php';
require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->fitri = User::factory()->withRole(Role::Anggota)->create(['name' => 'Fitri Handayani']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'OPS', 'name' => 'Divisi Operasional']);
    addMember($this->workspace, $this->rizky);
    addMember($this->workspace, $this->fitri);
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function scheduleInput(array $overrides = []): array
{
    $start = CarbonImmutable::parse('2026-10-06 13:30', 'Asia/Jakarta');

    return [
        'title' => 'Review vendor logistik',
        'starts_at' => $start,
        'ends_at' => $start->addHour(),
        'platform' => MeetingPlatform::Meet,
        'join_url' => 'https://meet.google.com/abc-defg-hij',
        'location' => 'diabaikan untuk rapat online',
        'agenda' => ['Evaluasi pengiriman', ' ', 'Penawaran harga'],
        'recurrence' => Recurrence::None,
        'reminders' => [15, 5],
        'participant_ids' => [],
        'guest_emails' => [],
        ...$overrides,
    ];
}

it('schedules a meeting: organizer says yes, minute taker and participants are invited', function () {
    $meeting = app(ScheduleMeeting::class)->handle($this->dimas, scheduleInput([
        'participant_ids' => [$this->rizky->id],
        'minute_taker_id' => $this->fitri->id,
        'guest_emails' => ['Logistik@SinarLogistik.co.id'],
        'workspace_id' => $this->workspace->id,
    ]));

    $seats = MeetingParticipant::query()->where('meeting_id', $meeting->id)->get();

    expect($meeting->agenda)->toBe(['Evaluasi pengiriman', 'Penawaran harga'])
        ->and($meeting->location)->toBeNull()
        ->and($meeting->company_id)->toBe($this->dimas->company_id)
        ->and($seats)->toHaveCount(4)
        ->and($seats->firstWhere('user_id', $this->dimas->id)?->rsvp)->toBe(Rsvp::Yes)
        ->and($seats->firstWhere('user_id', $this->fitri->id)?->rsvp)->toBe(Rsvp::Pending)
        ->and($seats->firstWhere('email', 'logistik@sinarlogistik.co.id'))->not->toBeNull();

    Notification::assertSentTo([$this->rizky, $this->fitri], MeetingInvitedNotification::class);
    Notification::assertNotSentTo($this->dimas, MeetingInvitedNotification::class);
});

it('ignores participants from another company', function () {
    $foreign = User::factory()->create(['company_id' => Company::factory()->create()->id]);

    $meeting = app(ScheduleMeeting::class)->handle($this->dimas, scheduleInput(['participant_ids' => [$this->rizky->id, $foreign->id]]));

    expect(MeetingParticipant::query()->where('meeting_id', $meeting->id)->pluck('user_id')->all())->not->toContain($foreign->id);
    Notification::assertNotSentTo($foreign, MeetingInvitedNotification::class);
});

it('asks for RSVP again and tells participants when the time moves', function () {
    $meeting = app(ScheduleMeeting::class)->handle($this->dimas, scheduleInput(['participant_ids' => [$this->rizky->id]]));
    app(UpdateRsvp::class)->handle($meeting, $this->rizky, Rsvp::Yes);
    Notification::fake();

    $start = CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Jakarta');
    app(UpdateMeeting::class)->handle($meeting, $this->dimas, scheduleInput([
        'starts_at' => $start,
        'ends_at' => $start->addHour(),
        'participant_ids' => [$this->rizky->id, $this->fitri->id],
    ]));

    expect(MeetingParticipant::query()->where('meeting_id', $meeting->id)->where('user_id', $this->rizky->id)->value('rsvp'))->toBe(Rsvp::Pending)
        ->and(MeetingParticipant::query()->where('meeting_id', $meeting->id)->where('user_id', $this->dimas->id)->value('rsvp'))->toBe(Rsvp::Yes);

    Notification::assertSentTo($this->rizky, MeetingInvitedNotification::class, fn ($n) => $n->mode === MeetingInvitedNotification::CHANGED);
    Notification::assertSentTo($this->fitri, MeetingInvitedNotification::class, fn ($n) => $n->mode === MeetingInvitedNotification::INVITED);
    Notification::assertSentToTimes($this->fitri, MeetingInvitedNotification::class, 1);
});

it('removes participants left out of an update, keeping the organizer', function () {
    $meeting = app(ScheduleMeeting::class)->handle($this->dimas, scheduleInput(['participant_ids' => [$this->rizky->id, $this->fitri->id]]));

    app(UpdateMeeting::class)->handle($meeting, $this->dimas, scheduleInput(['participant_ids' => [$this->fitri->id]]));

    expect(MeetingParticipant::query()->where('meeting_id', $meeting->id)->pluck('user_id')->sort()->values()->all())
        ->toBe(collect([$this->dimas->id, $this->fitri->id])->sort()->values()->all());
});

it('cancels a meeting once and tells the participants', function () {
    $meeting = app(ScheduleMeeting::class)->handle($this->dimas, scheduleInput(['participant_ids' => [$this->rizky->id]]));
    Notification::fake();

    app(CancelMeeting::class)->handle($meeting, $this->dimas);
    app(CancelMeeting::class)->handle($meeting->fresh(), $this->dimas);

    expect($meeting->fresh()?->isCanceled())->toBeTrue();
    Notification::assertSentToTimes($this->rizky, MeetingInvitedNotification::class, 1);
});

it('records the RSVP of a participant', function () {
    $meeting = Meeting::factory()->by($this->dimas)->withParticipants([$this->rizky])->create();

    app(UpdateRsvp::class)->handle($meeting, $this->rizky, Rsvp::Maybe);

    $seat = MeetingParticipant::query()->where('meeting_id', $meeting->id)->where('user_id', $this->rizky->id)->firstOrFail();
    expect($seat->rsvp)->toBe(Rsvp::Maybe)->and($seat->responded_at)->not->toBeNull();
});

it('autosaves minutes with at most one version per author per five minutes', function () {
    $meeting = Meeting::factory()->by($this->dimas)->at('2026-10-05 09:00', 30)->withParticipants([$this->rizky, $this->fitri])->create(['minute_taker_id' => $this->fitri->id]);
    $occurrence = occurrenceOf($meeting);
    $save = app(SaveMinutes::class);
    $content = fn (string $body) => [
        'attendance' => [['user_id' => $this->rizky->id, 'present' => true], ['user_id' => $this->fitri->id, 'present' => false, 'reason' => 'cuti']],
        'sections' => [['title' => 'Pembukaan', 'body' => $body]],
        'decisions' => ['Rapat berikutnya Rabu', ' '],
    ];

    $minutes = $save->handle($occurrence, $this->fitri, $content('Catatan 1'));
    $this->travel(2)->minutes();
    $save->handle($occurrence, $this->fitri, $content('Catatan 2'));
    $save->handle($occurrence, $this->fitri, $content('Catatan 2')); // unchanged: ignored

    expect(MeetingMinuteVersion::query()->where('minutes_id', $minutes->id)->count())->toBe(1)
        ->and(MeetingMinuteVersion::query()->where('minutes_id', $minutes->id)->value('content')['sections'][0]['body'] ?? null)->toBe('Catatan 2');

    $this->travel(6)->minutes();
    $save->handle($occurrence, $this->fitri, $content('Catatan 3'));
    $save->handle($occurrence, $this->dimas, $content('Catatan 4')); // another author: new version

    $minutes->refresh();
    expect(MeetingMinuteVersion::query()->where('minutes_id', $minutes->id)->count())->toBe(3)
        ->and($minutes->version)->toBe(3)
        ->and($minutes->decisions)->toBe(['Rapat berikutnya Rabu'])
        ->and($minutes->attendance[1])->toMatchArray(['present' => false, 'reason' => 'cuti'])
        ->and($minutes->updated_by)->toBe($this->dimas->id);
});

it('keeps separate minutes per occurrence of a series', function () {
    $standup = Meeting::factory()->by($this->dimas)->at('2026-09-28 09:00', 30)->recurring(Recurrence::MonWedFri)->create();

    app(SaveMinutes::class)->handle(occurrenceOf($standup, '2026-09-30'), $this->dimas, ['attendance' => [], 'sections' => [['title' => 'A', 'body' => 'Rabu']], 'decisions' => []]);
    app(SaveMinutes::class)->handle(occurrenceOf($standup, '2026-10-02'), $this->dimas, ['attendance' => [], 'sections' => [['title' => 'A', 'body' => 'Jumat']], 'decisions' => []]);

    expect(MeetingMinutes::query()->where('meeting_id', $standup->id)->orderBy('occurrence_date')->get()->map(fn ($m) => $m->sections[0]['body'])->all())
        ->toBe(['Rabu', 'Jumat']);
});

it('refuses to finalize incomplete minutes and names each problem', function () {
    $meeting = Meeting::factory()->by($this->dimas)->withParticipants([$this->rizky])->create();
    $occurrence = occurrenceOf($meeting);
    app(SaveMinutes::class)->handle($occurrence, $this->dimas, ['attendance' => [['user_id' => $this->rizky->id, 'present' => false]], 'sections' => [], 'decisions' => []]);
    app(AddActionItem::class)->handle($occurrence, $this->dimas, ['text' => '']);

    try {
        app(FinalizeMinutes::class)->handle($occurrence, $this->dimas);
        $this->fail('Expected a validation error.');
    } catch (ValidationException $exception) {
        expect($exception->errors()['minutes'])->toBe([
            'Tandai minimal satu peserta yang hadir.',
            'Tindak lanjut 1 belum diisi.',
            'Tindak lanjut 1 belum punya penanggung jawab.',
            'Tindak lanjut 1 belum punya tenggat.',
        ]);
    }

    expect(MeetingMinutes::query()->where('meeting_id', $meeting->id)->value('status'))->toBe(MinutesStatus::Draft);
});

it('finalizes minutes: locked, audited, versioned and shared with participants', function () {
    $meeting = Meeting::factory()->by($this->dimas)->withParticipants([$this->rizky, $this->fitri])->create(['minute_taker_id' => $this->fitri->id]);
    $occurrence = occurrenceOf($meeting);
    app(SaveMinutes::class)->handle($occurrence, $this->fitri, ['attendance' => [['user_id' => $this->rizky->id, 'present' => true]], 'sections' => [], 'decisions' => ['Setuju']]);
    app(AddActionItem::class)->handle($occurrence, $this->fitri, ['text' => 'Kirim jadwal servis', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-07']);

    $minutes = app(FinalizeMinutes::class)->handle($occurrence, $this->fitri);

    expect($minutes->status)->toBe(MinutesStatus::Final)
        ->and($minutes->finalized_by)->toBe($this->fitri->id)
        ->and(MeetingMinuteVersion::query()->where('minutes_id', $minutes->id)->count())->toBe(2)
        ->and(AuditLog::query()->where('action', 'meeting.minutes_finalized')->where('auditable_id', $minutes->id)->exists())->toBeTrue();

    Notification::assertSentTo([$this->rizky, $this->dimas], MinutesFinalizedNotification::class, fn ($n) => $n->decisions === 1 && $n->actionItems === 1);
    Notification::assertNotSentTo($this->fitri, MinutesFinalizedNotification::class);

    expect(fn () => app(SaveMinutes::class)->handle($occurrence, $this->fitri, ['attendance' => [], 'sections' => [], 'decisions' => []]))
        ->toThrow(ValidationException::class);
});

it('reopens final minutes and writes the audit log', function () {
    $meeting = Meeting::factory()->by($this->dimas)->withParticipants([$this->rizky])->create();
    $occurrence = occurrenceOf($meeting);
    app(SaveMinutes::class)->handle($occurrence, $this->dimas, ['attendance' => [['user_id' => $this->rizky->id, 'present' => true]], 'sections' => [], 'decisions' => []]);
    $minutes = app(FinalizeMinutes::class)->handle($occurrence, $this->dimas);

    $reopened = app(ReopenMinutes::class)->handle($minutes, $this->dimas);

    expect($reopened->status)->toBe(MinutesStatus::Draft)
        ->and($reopened->finalized_at)->toBeNull()
        ->and(AuditLog::query()->where('action', 'meeting.minutes_reopened')->where('auditable_id', $minutes->id)->exists())->toBeTrue();
});

it('updates, ticks off and removes follow-ups', function () {
    $meeting = Meeting::factory()->by($this->dimas)->create();
    $occurrence = occurrenceOf($meeting);
    $item = app(AddActionItem::class)->handle($occurrence, $this->dimas, ['text' => 'Kalibrasi timbangan']);
    $second = app(AddActionItem::class)->handle($occurrence, $this->dimas, ['text' => 'Cek forklift']);

    $item = app(UpdateActionItem::class)->handle($item, $this->dimas, ['assignee_id' => $this->rizky->id, 'due_date' => '2026-10-08', 'done' => true]);
    expect($item->assignee_id)->toBe($this->rizky->id)
        ->and($item->due_date?->toDateString())->toBe('2026-10-08')
        ->and($item->done_at)->not->toBeNull()
        ->and($second->position)->toBe(2);

    app(RemoveActionItem::class)->handle($second);
    expect(MeetingActionItem::query()->whereKey($second->id)->exists())->toBeFalse();
});

it('turns follow-ups into tasks in the meeting workspace, once', function () {
    $meeting = Meeting::factory()->by($this->dimas)->create(['workspace_id' => $this->workspace->id]);
    $occurrence = occurrenceOf($meeting);
    $first = app(AddActionItem::class)->handle($occurrence, $this->dimas, ['text' => 'Selesaikan rekap stok', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-07']);
    $second = app(AddActionItem::class)->handle($occurrence, $this->dimas, ['text' => 'Kirim jadwal servis', 'assignee_id' => $this->fitri->id, 'due_date' => '2026-10-08']);

    $created = app(ConvertActionItemsToTasks::class)->handle(occurrenceOf($meeting), $this->dimas, [$first->id, $second->id]);
    $again = app(ConvertActionItemsToTasks::class)->handle(occurrenceOf($meeting), $this->dimas, [$first->id, $second->id]);

    expect($created)->toHaveCount(2)
        ->and($again)->toBe([])
        ->and(Task::query()->where('workspace_id', $this->workspace->id)->count())->toBe(2);

    $task = Task::query()->findOrFail($first->fresh()?->task_id);
    expect($task->title)->toBe('Selesaikan rekap stok')
        ->and($task->due_date?->toDateString())->toBe('2026-10-07')
        ->and($task->assignees()->pluck('users.id')->all())->toBe([$this->rizky->id]);
});

it('asks for a workspace when the meeting has none, and checks the right to create tasks there', function () {
    $meeting = Meeting::factory()->by($this->rizky)->create();
    $occurrence = occurrenceOf($meeting);
    $item = app(AddActionItem::class)->handle($occurrence, $this->rizky, ['text' => 'Bagikan hasil impor', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-06']);

    expect(fn () => app(ConvertActionItemsToTasks::class)->handle($occurrence, $this->rizky, [$item->id]))
        ->toThrow(ValidationException::class);

    $viewerOnly = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'PLQ']);
    addMember($viewerOnly, $this->rizky, WorkspaceRole::Viewer);
    expect(fn () => app(ConvertActionItemsToTasks::class)->handle($occurrence, $this->rizky, [$item->id], $viewerOnly))
        ->toThrow(AuthorizationException::class);

    $created = app(ConvertActionItemsToTasks::class)->handle($occurrence, $this->rizky, [$item->id], $this->workspace);
    expect($created)->toHaveCount(1)->and($created[0]->workspace_id)->toBe($this->workspace->id);
});

it('reminds owners of open follow-ups at most once a day', function () {
    $meeting = Meeting::factory()->by($this->dimas)->withParticipants([$this->rizky, $this->fitri])->create();
    $occurrence = occurrenceOf($meeting);
    app(AddActionItem::class)->handle($occurrence, $this->dimas, ['text' => 'Rekap stok', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-07']);
    $done = app(AddActionItem::class)->handle($occurrence, $this->dimas, ['text' => 'Servis', 'assignee_id' => $this->fitri->id, 'due_date' => '2026-10-07']);
    app(UpdateActionItem::class)->handle($done, $this->fitri, ['done' => true]);

    expect(app(RemindActionItemOwners::class)->handle($occurrence, $this->dimas))->toBe([$this->rizky->id])
        ->and(app(RemindActionItemOwners::class)->handle($occurrence, $this->dimas))->toBe([]);

    Notification::assertSentToTimes($this->rizky, ActionItemDueNotification::class, 1);
    Notification::assertNotSentTo($this->fitri, ActionItemDueNotification::class);

    $this->travel(1)->days();
    expect(app(RemindActionItemOwners::class)->handle($occurrence, $this->dimas))->toBe([$this->rizky->id]);
});
