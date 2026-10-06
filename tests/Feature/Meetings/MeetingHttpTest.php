<?php

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Meetings\Actions\AddActionItem;
use App\Domain\Meetings\Actions\SaveMinutes;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Notifications\MeetingInvitedNotification;
use App\Domain\Organization\Enums\Role;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingParticipant;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/meeting-helpers.php';
require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config(['features.meetings' => true]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->dimas)->create(['key' => 'OPS', 'name' => 'Divisi Operasional']);
    addMember($this->workspace, $this->rizky);
    $this->meeting = Meeting::factory()->by($this->dimas)->at('2026-10-05 10:30')
        ->withParticipants([$this->rizky])
        ->create(['title' => 'Koordinasi peluncuran', 'workspace_id' => $this->workspace->id, 'minute_taker_id' => $this->dimas->id]);
});

it('renders the agenda with this week\'s meetings and open follow-ups', function () {
    $standup = Meeting::factory()->by($this->dimas)->at('2026-09-28 09:00', 30)->recurring(Recurrence::MonWedFri)
        ->withParticipants([$this->rizky])->create(['title' => 'Stand-up']);
    app(AddActionItem::class)->handle(occurrenceOf($this->meeting), $this->dimas, ['text' => 'Rekap stok', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-07']);

    $this->actingAs($this->rizky)->get('/rapat')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('meetings/index')
            ->where('agenda.viewer_id', $this->rizky->id)
            ->where('agenda.week_start', '2026-10-05')
            ->has('agenda.meetings', 4) // stand-up Mon/Wed/Fri + koordinasi
            ->where('agenda.meetings.0.title', 'Stand-up')
            ->where('agenda.meetings.0.href', '/rapat/'.$standup->id.'?tanggal=2026-10-05')
            ->where('agenda.meetings.1.href', '/rapat/'.$this->meeting->id)
            ->has('agenda.follow_ups', 1)
            ->where('agenda.follow_ups.0.text', 'Rekap stok')
            ->where('agenda.follow_ups.0.meeting_title', 'Koordinasi peluncuran')
            ->has('agenda.people', 2));

    $this->actingAs($this->outsider)->get('/rapat')
        ->assertInertia(fn (Assert $page) => $page->has('agenda.meetings', 0)->has('agenda.follow_ups', 0));
});

it('schedules a meeting from the form and redirects to it', function () {
    $this->actingAs($this->dimas)->get('/rapat/baru')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('meetings/create')
            ->where('form.viewer_id', $this->dimas->id)
            ->where('form.meeting', null)
            ->where('form.workspaces.0.key', 'OPS')
            ->has('form.people', 3));

    $response = $this->actingAs($this->dimas)->post('/rapat', meetingPayload([
        'participant_ids' => [$this->rizky->id],
        'guest_emails' => ['tamu@vendor.co.id'],
        'workspace_id' => $this->workspace->id,
        'agenda' => ['Evaluasi', ''],
    ]));

    $meeting = Meeting::query()->where('title', 'Review vendor logistik')->firstOrFail();
    $response->assertRedirect('/rapat/'.$meeting->id);

    expect($meeting->starts_at->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'))->toBe('2026-10-06 13:30')
        ->and($meeting->agenda)->toBe(['Evaluasi'])
        ->and(MeetingParticipant::query()->where('meeting_id', $meeting->id)->count())->toBe(3);
    Notification::assertSentTo($this->rizky, MeetingInvitedNotification::class);
});

it('validates the form in Indonesian', function () {
    $this->actingAs($this->dimas)->post('/rapat', meetingPayload([
        'title' => '',
        'date' => '2026-10-01',
        'platform' => 'zoom',
        'join_url' => null,
        'agenda' => [''],
    ]))->assertSessionHasErrors([
        'title',
        'date' => 'Tanggal sudah lewat. Pilih hari ini atau sesudahnya.',
        'join_url' => 'Tempel tautan Zoom lengkap, misalnya https://zoom.us/j/81234567890.',
    ]);

    $this->actingAs($this->dimas)->post('/rapat', meetingPayload(['platform' => 'room', 'location' => '']))
        ->assertSessionHasErrors(['location' => 'Isi ruangan atau alamat rapat.', 'participant_ids' => 'Undang minimal satu peserta selain Anda.']);

    $this->actingAs($this->rizky)->post('/rapat', meetingPayload([
        'participant_ids' => [$this->dimas->id],
        'workspace_id' => Workspace::factory()->create()->id,
    ]))->assertSessionHasErrors(['workspace_id']);
});

it('only lets dashboard.view_company holders mark leadership meetings', function () {
    $this->actingAs($this->rizky)->post('/rapat', meetingPayload(['participant_ids' => [$this->dimas->id], 'leadership' => true]))->assertRedirect();
    expect(Meeting::query()->latest('created_at')->latest('id')->firstOrFail()->leadership)->toBeFalse();

    $direksi = User::factory()->withRole(Role::Direksi)->create();
    $this->actingAs($direksi)->post('/rapat', meetingPayload(['title' => 'Rapat direksi', 'participant_ids' => [$this->dimas->id], 'leadership' => true]))->assertRedirect();
    expect(Meeting::query()->where('title', 'Rapat direksi')->firstOrFail()->leadership)->toBeTrue();
});

it('shows a meeting, its edit form, and hides it from others behind 404', function () {
    $this->actingAs($this->rizky)->get('/rapat/'.$this->meeting->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('meetings/show')
            ->where('detail.meeting.id', $this->meeting->id)
            ->where('detail.meeting.workspace.key', 'OPS')
            ->where('detail.meeting.minutes_status', 'none')
            ->where('detail.can.update', false)
            ->where('detail.can.respond', true)
            ->has('detail.meeting.participants', 2));

    $this->actingAs($this->dimas)->get('/rapat/'.$this->meeting->id.'/ubah')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('meetings/create')->where('form.meeting.start', '10:30')->where('form.meeting.duration', 60));
    $this->actingAs($this->rizky)->get('/rapat/'.$this->meeting->id.'/ubah')->assertForbidden();

    $this->actingAs($this->outsider)->get('/rapat/'.$this->meeting->id)->assertNotFound();
    $this->actingAs($this->outsider)->get('/rapat/'.$this->meeting->id.'/notulen')->assertNotFound();
    $this->actingAs($this->outsider)->postJson('/rapat/'.$this->meeting->id.'/kehadiran', ['rsvp' => 'yes'])->assertNotFound();
    $this->actingAs($this->outsider)->putJson('/rapat/'.$this->meeting->id.'/notulen', [])->assertNotFound();
});

it('updates and cancels a meeting as organizer only', function () {
    $this->actingAs($this->rizky)->patch('/rapat/'.$this->meeting->id, meetingPayload(['participant_ids' => [$this->dimas->id]]))->assertForbidden();

    $this->actingAs($this->dimas)->patch('/rapat/'.$this->meeting->id, meetingPayload([
        'title' => 'Koordinasi Q4',
        'date' => '2026-10-05',
        'start' => '11:00',
        'participant_ids' => [$this->rizky->id],
    ]))->assertRedirect('/rapat/'.$this->meeting->id);

    expect($this->meeting->fresh()?->title)->toBe('Koordinasi Q4');

    $this->actingAs($this->rizky)->delete('/rapat/'.$this->meeting->id)->assertForbidden();
    $this->actingAs($this->dimas)->delete('/rapat/'.$this->meeting->id)->assertRedirect('/rapat/'.$this->meeting->id);
    expect($this->meeting->fresh()?->isCanceled())->toBeTrue();
});

it('records RSVPs through JSON', function () {
    $this->actingAs($this->rizky)->postJson('/rapat/'.$this->meeting->id.'/kehadiran', ['rsvp' => 'maybe'])
        ->assertOk()->assertJson(['rsvp' => 'maybe']);
    $this->actingAs($this->rizky)->postJson('/rapat/'.$this->meeting->id.'/kehadiran', ['rsvp' => 'pending'])->assertUnprocessable();

    expect(MeetingParticipant::query()->where('meeting_id', $this->meeting->id)->where('user_id', $this->rizky->id)->value('rsvp'))->toBe(Rsvp::Maybe);
});

it('returns conflicts and a suggested slot as JSON', function () {
    Meeting::factory()->by($this->rizky)->at('2026-10-06 13:00')->create(['title' => 'Rapat gudang']);

    $this->actingAs($this->dimas)->getJson('/rapat/bentrok?'.http_build_query([
        'peserta' => [$this->rizky->id],
        'tanggal' => '2026-10-06',
        'mulai' => '13:30',
        'durasi' => 60,
    ]))->assertOk()
        ->assertJsonPath('conflicts.0.user_id', $this->rizky->id)
        ->assertJsonPath('conflicts.0.title', 'Rapat lain')
        ->assertJsonPath('suggestion', '14:00');
});

it('renders minutes, autosaves, finalizes and reopens them', function () {
    $this->actingAs($this->dimas)->get('/rapat/'.$this->meeting->id.'/notulen')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('meetings/minutes')
            ->where('record.minutes.id', null)
            ->where('record.minutes.status', 'draft')
            ->has('record.minutes.attendance', 2)
            ->has('record.minutes.sections', 2)
            ->where('record.can.edit', true)
            ->where('record.can.reopen', true));

    $this->actingAs($this->rizky)->putJson('/rapat/'.$this->meeting->id.'/notulen', [
        'attendance' => [], 'sections' => [], 'decisions' => [],
    ])->assertForbidden();

    $this->actingAs($this->dimas)->putJson('/rapat/'.$this->meeting->id.'/notulen', [
        'attendance' => [['user_id' => $this->rizky->id, 'present' => true]],
        'sections' => [['title' => 'Pembukaan', 'body' => 'Dibuka 10.30']],
        'decisions' => ['Peluncuran tetap 26 Okt'],
    ])->assertOk()
        ->assertJsonPath('minutes.version_count', 1)
        ->assertJsonPath('minutes.decisions.0', 'Peluncuran tetap 26 Okt');

    $item = $this->actingAs($this->dimas)->postJson('/rapat/'.$this->meeting->id.'/tindak-lanjut', ['text' => ''])
        ->assertCreated()->json('item.id');

    $this->actingAs($this->dimas)->postJson('/rapat/'.$this->meeting->id.'/notulen/final')
        ->assertUnprocessable()
        ->assertJsonPath('errors.minutes.0', 'Tindak lanjut 1 belum diisi.');

    $this->actingAs($this->dimas)->patchJson('/rapat/'.$this->meeting->id.'/tindak-lanjut/'.$item, [
        'text' => 'Kirim jadwal servis', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-07',
    ])->assertOk()->assertJsonPath('item.assignee_id', $this->rizky->id);

    $this->actingAs($this->dimas)->postJson('/rapat/'.$this->meeting->id.'/notulen/final')
        ->assertOk()->assertJsonPath('minutes.status', 'final');

    // Final: content locked, the assignee may still tick their follow-up off.
    $this->actingAs($this->dimas)->putJson('/rapat/'.$this->meeting->id.'/notulen', ['attendance' => [], 'sections' => [], 'decisions' => []])->assertForbidden();
    $this->actingAs($this->rizky)->patchJson('/rapat/'.$this->meeting->id.'/tindak-lanjut/'.$item, ['done' => true])
        ->assertOk()->assertJsonPath('item.done', true);
    $this->actingAs($this->rizky)->postJson('/rapat/'.$this->meeting->id.'/notulen/buka')->assertForbidden();

    $this->actingAs($this->dimas)->postJson('/rapat/'.$this->meeting->id.'/notulen/buka')
        ->assertOk()->assertJsonPath('minutes.status', 'draft');
});

it('turns follow-ups into tasks and reminds owners through JSON', function () {
    $occurrence = occurrenceOf($this->meeting);
    $item = app(AddActionItem::class)->handle($occurrence, $this->dimas, ['text' => 'Rekap stok', 'assignee_id' => $this->rizky->id, 'due_date' => '2026-10-07']);

    $this->actingAs($this->dimas)->postJson('/rapat/'.$this->meeting->id.'/notulen/ingatkan')
        ->assertOk()->assertJson(['reminded' => [$this->rizky->id]]);

    $this->actingAs($this->rizky)->postJson('/rapat/'.$this->meeting->id.'/notulen/tugas', ['item_ids' => [$item->id]])->assertForbidden();

    $this->actingAs($this->dimas)->postJson('/rapat/'.$this->meeting->id.'/notulen/tugas', ['item_ids' => [$item->id]])
        ->assertOk()
        ->assertJsonPath('created', 1)
        ->assertJsonPath('minutes.action_items.0.task_key', 'OPS-'.Task::query()->value('number'));

    expect(MeetingActionItem::query()->whereKey($item->id)->value('task_id'))->not->toBeNull();
});

it('keeps follow-ups of another meeting out of reach', function () {
    $other = Meeting::factory()->by($this->dimas)->create();
    $foreignItem = app(AddActionItem::class)->handle(occurrenceOf($other), $this->dimas, ['text' => 'Lain']);

    $this->actingAs($this->dimas)->patchJson('/rapat/'.$this->meeting->id.'/tindak-lanjut/'.$foreignItem->id, ['text' => 'x'])->assertNotFound();
});

it('opens the minutes of one occurrence of a series', function () {
    $standup = Meeting::factory()->by($this->dimas)->at('2026-09-28 09:00', 30)->recurring(Recurrence::MonWedFri)->create();
    app(SaveMinutes::class)->handle(occurrenceOf($standup, '2026-09-30'), $this->dimas, ['attendance' => [], 'sections' => [['title' => 'A', 'body' => 'Rabu']], 'decisions' => []]);

    $this->actingAs($this->dimas)->get('/rapat/'.$standup->id.'/notulen?tanggal=2026-09-30')
        ->assertInertia(fn (Assert $page) => $page
            ->where('record.meeting.occurrence_date', '2026-09-30')
            ->where('record.minutes.sections.0.body', 'Rabu'));

    $this->actingAs($this->dimas)->putJson('/rapat/'.$standup->id.'/notulen?tanggal=2026-10-02', [
        'attendance' => [], 'sections' => [['title' => 'A', 'body' => 'Jumat']], 'decisions' => [],
    ])->assertOk();

    expect(MeetingMinutes::query()->where('meeting_id', $standup->id)->count())->toBe(2);
});

it('renders the calendar with meetings, deadlines, leave and holidays', function () {
    $task = Task::factory()->create(['workspace_id' => $this->workspace->id, 'due_date' => '2026-10-07', 'title' => 'Rekap stok']);
    $task->assignees()->attach($this->rizky->id, ['assigned_at' => now()]);
    Holiday::query()->create(['company_id' => $this->rizky->company_id, 'date' => '2026-10-23', 'name' => 'HUT perusahaan', 'type' => 'company']);

    $this->actingAs($this->rizky)->get('/kalender?bulan=2026-10')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('meetings/calendar')
            ->where('calendar.year', 2026)
            ->where('calendar.month', 10)
            ->where('calendar.from', '2026-09-28')
            ->where('calendar.to', '2026-11-01')
            ->where('calendar.entries', fn ($entries) => collect($entries)->pluck('layer')->sort()->values()->all() === ['holidays', 'meetings', 'tasks']));
});

it('shows the leadership schedule to dashboard.view_company only', function () {
    $direksi = User::factory()->withRole(Role::Direksi)->create();
    Meeting::factory()->by($direksi)->at('2026-10-06 10:00')->leadership()->create(['title' => 'Rapat direksi mingguan']);

    $this->actingAs($direksi)->get('/manajemen/jadwal')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('meetings/management-schedule')
            ->has('schedule.meetings', 1)
            ->where('schedule.meetings.0.title', 'Rapat direksi mingguan'));

    $this->actingAs($this->rizky)->get('/manajemen/jadwal')->assertForbidden();
});

it('answers 404 when the feature is off and sends guests to login', function (string $uri) {
    $this->get($uri)->assertRedirect(route('login'));

    config(['features.meetings' => false]);
    $this->actingAs($this->dimas)->get($uri)->assertNotFound();
})->with(['/rapat', '/rapat/baru', '/kalender', '/manajemen/jadwal']);

it('hides the meeting in the shared feature flags when off', function () {
    expect($this->actingAs($this->dimas)->get('/rapat')->inertiaProps('features.meetings'))->toBeTrue();
});
