<?php

use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\ConvertActionItemsToTasks;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Jobs\SendActionItemReminders;
use App\Domain\Meetings\Jobs\SendMeetingReminders;
use App\Domain\Meetings\Notifications\ActionItemDueNotification;
use App\Domain\Meetings\Notifications\MeetingStartingNotification;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\Role;
use App\Models\InboxNotification;
use App\Models\Meeting;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/meeting-helpers.php';
require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->rizky = User::factory()->withRole(Role::Anggota)->create();
    $this->sari = User::factory()->withRole(Role::Anggota)->create();
});

function runMeetingReminders(): int
{
    return app()->call([new SendMeetingReminders, 'handle']);
}

it('sends "rapat segera dimulai" at each reminder offset, once per participant', function () {
    Notification::fake();
    Meeting::factory()->by($this->dimas)->at('2026-10-05 10:30')->withParticipants([$this->rizky])
        ->withParticipants([$this->sari], Rsvp::No)->create(['reminders' => [15, 5]]);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:10', 'Asia/Jakarta'));
    expect(runMeetingReminders())->toBe(0);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:15', 'Asia/Jakarta'));
    expect(runMeetingReminders())->toBe(2) // Dimas & Rizky, not Sari (declined)
        ->and(runMeetingReminders())->toBe(0);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:26', 'Asia/Jakarta'));
    expect(runMeetingReminders())->toBe(2);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:31', 'Asia/Jakarta'));
    expect(runMeetingReminders())->toBe(0);

    Notification::assertSentToTimes($this->rizky, MeetingStartingNotification::class, 2);
    Notification::assertSentTo($this->rizky, MeetingStartingNotification::class, fn ($n) => $n->minutes === 4);
    Notification::assertNotSentTo($this->sari, MeetingStartingNotification::class);
});

it('reminds once when a meeting is scheduled after its reminder times passed', function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:27', 'Asia/Jakarta'));
    Meeting::factory()->by($this->dimas)->at('2026-10-05 10:30')->withParticipants([$this->rizky])->create(['reminders' => [15, 5]]);

    expect(runMeetingReminders())->toBe(2)->and(runMeetingReminders())->toBe(0);
});

it('reminds every occurrence of a series and skips canceled meetings', function () {
    Notification::fake();
    Meeting::factory()->by($this->dimas)->at('2026-10-05 09:00', 30)->recurring(Recurrence::MonWedFri)->create(['reminders' => [5]]);
    Meeting::factory()->by($this->dimas)->at('2026-10-07 09:30')->create(['reminders' => [5], 'canceled_at' => now()]);

    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:56', 'Asia/Jakarta'));
    expect(runMeetingReminders())->toBe(1);

    $this->travelTo(CarbonImmutable::parse('2026-10-07 08:56', 'Asia/Jakarta'));
    expect(runMeetingReminders())->toBe(1);

    $this->travelTo(CarbonImmutable::parse('2026-10-07 09:26', 'Asia/Jakarta'));
    expect(runMeetingReminders())->toBe(0);
});

it('reminds assignees of follow-ups due tomorrow and overdue, once per due date', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta'));
    $meeting = Meeting::factory()->by($this->dimas)->withParticipants([$this->rizky, $this->sari])->create();
    $occurrence = occurrenceOf($meeting);
    $add = app(AddActionItem::class);
    $soon = $add->handle($occurrence, $this->dimas, ['text' => 'Rekap stok', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-06']);
    $add->handle($occurrence, $this->dimas, ['text' => 'Servis truk', 'assignee_id' => $this->sari->id, 'due_date' => '2026-10-02']);
    $add->handle($occurrence, $this->dimas, ['text' => 'Belum mendesak', 'assignee_id' => $this->sari->id, 'due_date' => '2026-10-20']);

    $job = new SendActionItemReminders;

    expect(app()->call([$job, 'handle']))->toBe(['soon' => 1, 'overdue' => 1])
        ->and(app()->call([$job, 'handle']))->toBe(['soon' => 0, 'overdue' => 0]);

    $reminder = InboxNotification::query()->where('notifiable_id', $this->rizky->id)->ofType(NotificationType::ActionItemDue)->firstOrFail();
    expect($reminder->action_required)->toBeTrue()
        ->and($reminder->data['title'])->toBe('Tindak lanjut rapat jatuh tempo besok');

    // Turning it into a task settles the reminder.
    $workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'OPS']);
    addMember($workspace, $this->rizky);
    app(ConvertActionItemsToTasks::class)->handle($occurrence, $this->dimas, [$soon->id], $workspace);

    expect($reminder->fresh()?->resolved_at)->not->toBeNull();
});

it('does not remind follow-ups of canceled meetings', function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta'));
    $meeting = Meeting::factory()->by($this->dimas)->withParticipants([$this->rizky])->create();
    app(AddActionItem::class)->handle(occurrenceOf($meeting), $this->dimas, ['text' => 'Rekap', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-01']);
    $meeting->update(['canceled_at' => now()]);

    expect(app()->call([new SendActionItemReminders, 'handle']))->toBe(['soon' => 0, 'overdue' => 0]);
    Notification::assertNotSentTo($this->rizky, ActionItemDueNotification::class);
});
