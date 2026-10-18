<?php

use App\Domain\Meetings\Actions\ChooseMinutesSource;
use App\Domain\Meetings\Actions\RecordVideoEvent;
use App\Domain\Meetings\Actions\ReportSpeakingTime;
use App\Domain\Meetings\Actions\SaveMinutes;
use App\Domain\Meetings\Enums\MinutesSource;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Events\MeetingRoomBroadcast;
use App\Domain\Meetings\Jobs\PruneSpeakingTimes;
use App\Domain\Meetings\Notifications\MeetingCalledNotification;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Services\MinutesDocument;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Organization\Enums\Role;
use App\Http\Resources\Meetings\RoomPresenter;
use App\Models\AuditLog;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingAttendance;
use App\Models\MeetingMinutes;
use App\Models\MeetingSpeakingTime;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
 * Ruang rapat "Notulen Hidup" (docs/fitur/rapat-video-kontrak.md): room
 * props, notes source on pre-join, speaking time, Kehadiran + Panggil,
 * broadcasts on meeting.{id}. A weekly video series: last week's minutes have
 * open follow-ups; today (Mon 12 Oct 2026, 09.00–10.00 WIB) is the occurrence.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config([
        'features.meetings' => true,
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => 'test-secret-that-is-at-least-32-characters',
        'collab.secret' => '', // autosave mode unless a test turns collaboration on
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-12 09:05', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->sari = User::factory()->withRole(Role::Anggota)->create(['name' => 'Sari Notulis']);
    $this->nadia = User::factory()->withRole(Role::Anggota)->create(['name' => 'Nadia Putri']);
    $this->lukman = User::factory()->withRole(Role::Anggota)->create(['name' => 'Lukman Hakim']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 09:00')
        ->recurring(Recurrence::Weekly)
        ->withParticipants([$this->sari, $this->nadia, $this->lukman])
        ->create(['title' => 'Rapat mingguan Operasional', 'minute_taker_id' => $this->sari->id, 'agenda' => ['Rekap stok', 'Perawatan kendaraan']]);
    $this->base = "/rapat/{$this->meeting->id}";
    $this->q = '?tanggal=2026-10-12';

    // Last week's minutes: one open follow-up (Nadia, due 9 Oct) and one done.
    $this->previous = MeetingMinutes::query()->create([
        'meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-10-05', 'status' => 'final',
        'finalized_at' => now()->subWeek(), 'sections' => [['title' => 'Rekap stok', 'body' => 'Selisih 0,8%']],
    ]);
    MeetingActionItem::query()->create(['minutes_id' => $this->previous->id, 'position' => 1, 'text' => 'Kirim jadwal servis ke vendor', 'assignee_id' => $this->nadia->id, 'due_date' => '2026-10-09']);
    MeetingActionItem::query()->create(['minutes_id' => $this->previous->id, 'position' => 2, 'text' => 'Sudah beres', 'done_at' => now()->subDays(3)]);
});

function roomJoin(User $user, int $minutesAgo, ?string $sid = null): void
{
    $meeting = test()->meeting;
    MeetingAttendance::query()->create([
        'meeting_id' => $meeting->id, 'occurrence_date' => '2026-10-12', 'user_id' => $user->id,
        'room' => 'rk-'.strtolower($meeting->id).'-20261012', 'participant_sid' => $sid ?? 'PA_'.$user->id,
        'joined_at' => now()->subMinutes($minutesAgo),
    ]);
}

describe('room props', function () {
    it('gives both pages participants, navigator, minutes, notes source, speaking, features and abilities', function (string $path, string $component) {
        roomJoin($this->dimas, 6);
        roomJoin($this->nadia, 1);

        $this->actingAs($this->sari)->get("{$this->base}/{$path}{$this->q}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component($component)
                ->where('notulen', null)
                ->where('room.meeting.minute_taker_id', $this->sari->id)
                ->where('room.meeting.is_recurring', true)
                ->where('room.meeting.agenda', ['Rekap stok', 'Perawatan kendaraan'])
                ->has('room.participants', 4)
                ->where('room.participants.0.id', $this->dimas->id)
                ->where('room.participants.0.roles', ['organizer'])
                ->where('room.participants.0.role_label', 'Penyelenggara')
                ->where('room.participants.0.initials', 'DP')
                ->where('room.participants.0.first_name', 'Dimas')
                ->where('room.participants.0.tone', 'blue')
                ->where('room.participants.0.seat', 0)
                ->where('room.participants.1.id', $this->sari->id)
                ->where('room.participants.1.roles', ['minute_taker'])
                ->where('room.participants.1.tone', 'amber')
                ->where('room.participants.2.id', $this->lukman->id)
                ->where('room.participants.3.id', $this->nadia->id)
                ->where('room.participants.3.tone', 'teal')
                ->where('room.agenda.0', ['key' => 'section-0', 'index' => 0, 'title' => 'Rekap stok', 'kind' => 'agenda', 'has_notes' => false])
                ->where('room.agenda.2.key', 'decisions')
                ->where('room.agenda.3.key', 'action-items')
                ->where('room.minutes.mode', 'autosave')
                ->where('room.minutes.collab', null)
                ->where('room.minutes.doc.id', null)
                ->where('room.minutes.doc.source', null)
                ->where('room.minutes.links.data', "{$this->base}/notulen/data{$this->q}")
                ->where('room.minutes.links.save', "{$this->base}/notulen{$this->q}")
                ->where('room.notes_source.chosen', null)
                ->where('room.notes_source.can_choose', true)
                ->where('room.notes_source.suggested', 'continue')
                ->where('room.notes_source.previous.occurrence_date', '2026-10-05')
                ->where('room.notes_source.previous.status', 'final')
                ->where('room.notes_source.previous.open_count', 1)
                ->where('room.notes_source.open_follow_ups.0.text', 'Kirim jadwal servis ke vendor')
                ->where('room.notes_source.open_follow_ups.0.overdue', true)
                ->where('room.notes_source.template.sections', ['Rekap stok', 'Perawatan kendaraan'])
                ->where('room.notes_source.template.key', 'agenda')
                ->where('room.notes_source.template.label', 'Templat Rapat mingguan')
                ->where('room.minutes.editing', null)
                ->where('room.minutes.can_edit_attendance', true)
                ->where('room.speaking.total_ms', 0)
                ->where('room.speaking.mine_ms', 0)
                ->where('room.speaking.silent', [$this->dimas->id, $this->nadia->id])
                ->where('room.video.in_room', 2)
                ->where('room.video.attendance.0.user_id', $this->dimas->id)
                ->where('room.video.attendance.0.late', false)
                ->where('room.video.attendance.1.late_minutes', 4)
                ->where('room.video.attendance.1.late', true)
                ->where('room.video.not_joined.0.user_id', $this->sari->id)
                ->where('room.video.not_joined.1.user_id', $this->lukman->id)
                ->where('room.video.late_grace_minutes', 2)
                ->where('room.features.video_configured', true)
                ->where('room.features.auto_minutes', false)
                ->where('room.features.collab_minutes', false)
                ->where('room.can', [
                    'edit_minutes' => true,
                    'choose_notes_source' => true,
                    'moderate' => false,
                    'manage_guests' => false,
                    'manage_lobby' => true,
                    'call_participants' => true,
                    'report_speaking' => true,
                ])
                ->where('room.channel', 'meeting.'.$this->meeting->id)
                ->where('room.links.call', "{$this->base}/video/panggil/{user}{$this->q}"));
    })->with([
        'pre-join' => ['gabung', 'meetings/join'],
        'room' => ['ruang', 'meetings/room'],
    ]);

    it('gives a plain participant read-only abilities and the organizer moderation', function () {
        $this->actingAs($this->nadia)->get("{$this->base}/ruang{$this->q}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('room.can.edit_minutes', false)
                ->where('room.can.choose_notes_source', false)
                ->where('room.can.call_participants', false)
                ->where('room.can.moderate', false)
                ->where('room.notes_source.can_choose', false));

        $this->actingAs($this->dimas)->get("{$this->base}/ruang{$this->q}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('room.can.moderate', true)
                ->where('room.can.call_participants', true));
    });

    it('computes the same avatar tone as avatarTone() in the browser', function () {
        // Expected values from components/ui/avatar.tsx (node, same hash).
        expect(RoomPresenter::tone('Dimas Pratama'))->toBe('blue')
            ->and(RoomPresenter::tone('Sari Notulis'))->toBe('amber')
            ->and(RoomPresenter::tone('Nadia Putri'))->toBe('teal')
            ->and(RoomPresenter::tone('Hana Pratiwi'))->toBe('teal')
            ->and(RoomPresenter::tone('Ayu 🌸 Lestari'))->toBe('amber')
            ->and(RoomPresenter::initials('  maya   lestari putri '))->toBe('ML');
    });

    it('serves fresh minutes as JSON for the room refetch', function () {
        $this->actingAs($this->nadia)->getJson("{$this->base}/notulen/data{$this->q}")
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('minutes.status', 'draft')
            ->assertJsonPath('minutes.sections.0.title', 'Rekap stok');

        $this->actingAs($this->outsider)->getJson("{$this->base}/notulen/data{$this->q}")->assertNotFound();
    });
});

describe('notes source', function () {
    it('continues with the open follow-ups of the previous minutes, once per occurrence', function () {
        Event::fake([MeetingRoomBroadcast::class]);

        $this->actingAs($this->sari)->postJson("{$this->base}/video/sumber-notulen{$this->q}", ['source' => 'continue'])
            ->assertOk()
            ->assertJsonPath('applied', true)
            ->assertJsonPath('notes_source.chosen', 'continue')
            ->assertJsonPath('notes_source.chosen_by', $this->sari->id)
            ->assertJsonPath('notes_source.can_choose', false)
            ->assertJsonPath('minutes.source', 'continue')
            ->assertJsonPath('minutes.sections.2.title', ChooseMinutesSource::CARRY_OVER_TITLE)
            ->assertJsonPath('minutes.sections.2.body', '• Kirim jadwal servis ke vendor — Nadia Putri · tenggat 9 Okt');

        // Choosing again (same or another source) changes nothing.
        $this->actingAs($this->dimas)->postJson("{$this->base}/video/sumber-notulen{$this->q}", ['source' => 'continue'])
            ->assertOk()->assertJsonPath('applied', false);
        $this->actingAs($this->dimas)->postJson("{$this->base}/video/sumber-notulen{$this->q}", ['source' => 'blank'])
            ->assertOk()->assertJsonPath('applied', false)->assertJsonPath('notes_source.chosen', 'continue');

        $minutes = MeetingMinutes::query()->where('meeting_id', $this->meeting->id)->whereDate('occurrence_date', '2026-10-12')->sole();
        expect($minutes->sections)->toHaveCount(3)
            ->and($minutes->notes_source)->toBe(MinutesSource::Continue)
            ->and($minutes->version)->toBe(1);

        Event::assertDispatched(MeetingRoomBroadcast::class, fn (MeetingRoomBroadcast $event) => $event->name === 'minutes.source_chosen'
            && $event->payload['occurrence_date'] === '2026-10-12' && $event->payload['source'] === 'continue'
            && $event->broadcastOn()[0]->name === 'private-meeting.'.$this->meeting->id);
        Event::assertDispatchedTimes(MeetingRoomBroadcast::class, 2);

        // The room now shows the choice to everyone.
        $this->actingAs($this->nadia)->get("{$this->base}/gabung{$this->q}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('room.notes_source.chosen', 'continue')
                ->where('room.agenda.2.kind', 'extra')
                ->where('room.agenda.2.has_notes', true));
    });

    it('applies the weekly template keeping what was written', function () {
        app(SaveMinutes::class)->handle(occurrenceOf($this->meeting, '2026-10-12'), $this->sari, [
            'attendance' => [],
            'sections' => [['title' => 'Lain-lain', 'body' => 'Catatan'], ['title' => 'Perawatan kendaraan', 'body' => 'Ban aus']],
            'decisions' => [],
        ]);

        $this->actingAs($this->sari)->postJson("{$this->base}/video/sumber-notulen{$this->q}", ['source' => 'template'])
            ->assertOk()
            ->assertJsonPath('minutes.sections', [
                ['title' => 'Rekap stok', 'body' => ''],
                ['title' => 'Perawatan kendaraan', 'body' => 'Ban aus'],
                ['title' => 'Lain-lain', 'body' => 'Catatan'],
            ]);

        expect(ChooseMinutesSource::templated([], []))->toBe([['title' => 'Agenda', 'body' => '']]);
    });

    it('empties an untouched draft for "blank" but never deletes written notes', function () {
        $this->actingAs($this->sari)->postJson("{$this->base}/video/sumber-notulen{$this->q}", ['source' => 'blank'])
            ->assertOk()->assertJsonPath('minutes.sections', []);

        $other = Meeting::factory()->by($this->dimas)->video()->at('2026-10-12 09:00')->create(['minute_taker_id' => $this->sari->id]);
        app(SaveMinutes::class)->handle(occurrenceOf($other), $this->sari, ['attendance' => [], 'sections' => [['title' => 'Pembukaan', 'body' => 'Sudah ditulis']], 'decisions' => []]);

        $this->actingAs($this->sari)->postJson("/rapat/{$other->id}/video/sumber-notulen", ['source' => 'blank'])
            ->assertOk()->assertJsonPath('applied', true)->assertJsonPath('minutes.sections.0.body', 'Sudah ditulis');
    });

    it('records the choice without a section when there is nothing open', function () {
        $single = Meeting::factory()->by($this->dimas)->video()->at('2026-10-12 09:00')->create();

        $this->actingAs($this->dimas)->get("/rapat/{$single->id}/gabung")
            ->assertInertia(fn (Assert $page) => $page
                ->where('room.notes_source.previous', null)
                ->where('room.notes_source.suggested', 'template')
                ->where('room.notes_source.template.label', 'Templat '.$single->title));
        $this->actingAs($this->dimas)->postJson("/rapat/{$single->id}/video/sumber-notulen", ['source' => 'continue'])
            ->assertOk()->assertJsonPath('applied', true)->assertJsonPath('minutes.sections', [['title' => 'Pembukaan', 'body' => ''], ['title' => 'Pembahasan', 'body' => '']]);
    });

    it('lets only the organizer or minute taker choose, on a draft', function () {
        $this->actingAs($this->nadia)->postJson("{$this->base}/video/sumber-notulen{$this->q}", ['source' => 'continue'])->assertForbidden();
        $this->actingAs($this->outsider)->postJson("{$this->base}/video/sumber-notulen{$this->q}", ['source' => 'continue'])->assertNotFound();
        $this->actingAs($this->sari)->postJson("{$this->base}/video/sumber-notulen{$this->q}", ['source' => 'lanjutkan'])->assertUnprocessable();

        $this->actingAs($this->sari)->postJson("{$this->base}/video/sumber-notulen?tanggal=2026-10-05", ['source' => 'template'])->assertForbidden();
        expect(MeetingMinutes::query()->whereNotNull('notes_source')->count())->toBe(0);
    });
});

describe('speaking time', function () {
    it('accepts each participant\'s own monotonic total, capped by the clock', function () {
        $occurrence = occurrenceOf($this->meeting, '2026-10-12');
        $report = app(ReportSpeakingTime::class);

        // First report without webhook data: at most 60 s.
        expect($report->handle($occurrence, $this->sari, 300_000))->toBe(ReportSpeakingTime::FIRST_REPORT_MAX_MS);

        // Within 3 s: ignored.
        $this->travel(2)->seconds();
        expect($report->handle($occurrence, $this->sari, 61_000))->toBe(60_000);

        // Never seen in the room (no webhook data): never more than 60 s in total
        // (audit rapat 2026-10 B-01); decreases are ignored.
        $this->travel(13)->seconds();
        expect($report->handle($occurrence, $this->sari, 999_000))->toBe(60_000);
        $this->travel(15)->seconds();
        expect($report->handle($occurrence, $this->sari, 10_000))->toBe(60_000);

        // In the room: at most stored + elapsed + 5 s slack, and the time spent in the room + 5 s.
        roomJoin($this->sari, 2);
        $this->travel(15)->seconds();
        expect($report->handle($occurrence, $this->sari, 999_000))->toBe(60_000 + 15_000 + 5_000);

        // With the webhook join time: at most time since joining + 5 s.
        roomJoin($this->nadia, 2);
        expect($report->handle($occurrence, $this->nadia, 500_000))->toBe(125_000);
    });

    it('returns totals with shares and who has not spoken, for participants only', function () {
        roomJoin($this->dimas, 5);
        roomJoin($this->nadia, 5);
        roomJoin($this->lukman, 5);

        $this->actingAs($this->dimas)->postJson("{$this->base}/video/bicara{$this->q}", ['ms' => 45_000])
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('accepted_ms', 45_000)
            ->assertJsonPath('mine_ms', 45_000);
        $this->actingAs($this->nadia)->postJson("{$this->base}/video/bicara{$this->q}", ['ms' => 15_000])->assertOk();
        $this->actingAs($this->lukman)->postJson("{$this->base}/video/bicara{$this->q}", ['ms' => 0])->assertOk();

        $this->actingAs($this->sari)->getJson("{$this->base}/video/bicara{$this->q}")
            ->assertOk()
            ->assertJsonPath('total_ms', 60_000)
            ->assertJsonPath('people.0', ['user_id' => $this->dimas->id, 'ms' => 45_000, 'share' => 75])
            ->assertJsonPath('people.1', ['user_id' => $this->nadia->id, 'ms' => 15_000, 'share' => 25])
            ->assertJsonPath('silent', [$this->lukman->id])
            ->assertJsonPath('mine_ms', 0)
            ->assertJsonPath('interval_seconds', 15);

        $this->actingAs($this->outsider)->getJson("{$this->base}/video/bicara{$this->q}")->assertNotFound();
        $this->actingAs($this->outsider)->postJson("{$this->base}/video/bicara{$this->q}", ['ms' => 1])->assertNotFound();
        $this->actingAs($this->nadia)->postJson("{$this->base}/video/bicara{$this->q}", ['ms' => -1])->assertUnprocessable();
        expect(MeetingSpeakingTime::query()->count())->toBe(3);
    });

    it('refuses reports outside the join window (organizer any time)', function () {
        $this->actingAs($this->nadia)->postJson("{$this->base}/video/bicara?tanggal=2026-10-19", ['ms' => 1000])->assertForbidden();
        $this->actingAs($this->dimas)->postJson("{$this->base}/video/bicara?tanggal=2026-10-19", ['ms' => 1000])->assertOk();
    });

    it('broadcasts speaking.updated at most once per 5 seconds per occurrence', function () {
        Event::fake([MeetingRoomBroadcast::class]);
        roomJoin($this->dimas, 5);
        roomJoin($this->nadia, 5);
        $occurrence = occurrenceOf($this->meeting, '2026-10-12');

        app(ReportSpeakingTime::class)->handle($occurrence, $this->dimas, 10_000);
        app(ReportSpeakingTime::class)->handle($occurrence, $this->nadia, 4_000);
        $this->travel(6)->seconds();
        app(ReportSpeakingTime::class)->handle($occurrence, $this->nadia, 8_000);

        Event::assertDispatchedTimes(MeetingRoomBroadcast::class, 2);
        Event::assertDispatched(MeetingRoomBroadcast::class, fn (MeetingRoomBroadcast $event) => $event->name === 'speaking.updated'
            && $event->payload['totals']['total_ms'] === 18_000 && ! isset($event->payload['totals']['mine_ms']));
    });
});

describe('kehadiran and panggil', function () {
    it('lists attendance with late badges and invited people who did not join, in one query', function () {
        roomJoin($this->dimas, 5);
        $occurrence = occurrenceOf($this->meeting, '2026-10-12');
        $attendance = app(VideoAttendance::class);

        $count = function () use ($attendance, $occurrence): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $attendance->roster($occurrence);
            $queries = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $queries;
        };

        $attendance->roster($occurrence); // loads the participants relation once
        $small = $count();
        roomJoin($this->nadia, 1);
        roomJoin($this->lukman, 3, 'PA_l1');
        MeetingAttendance::query()->where('participant_sid', 'PA_l1')->update(['left_at' => now()->subMinute(), 'duration_seconds' => 120]);
        roomJoin($this->lukman, 0, 'PA_l2');
        expect($count())->toBe($small)->toBe(1);

        $this->actingAs($this->nadia)->getJson("{$this->base}/video/kehadiran{$this->q}")
            ->assertOk()
            ->assertJsonPath('in_room', 3)
            ->assertJsonPath('attendance.0.user_id', $this->dimas->id)
            ->assertJsonPath('attendance.0.late_minutes', 0)
            ->assertJsonPath('attendance.1.user_id', $this->lukman->id)
            ->assertJsonPath('attendance.1.sessions', 2)
            ->assertJsonPath('attendance.1.late_minutes', 2)
            ->assertJsonPath('attendance.1.late', false)
            ->assertJsonPath('attendance.1.duration_seconds', 120)
            ->assertJsonPath('attendance.2.late_minutes', 4)
            ->assertJsonPath('attendance.2.late', true)
            ->assertJsonPath('not_joined', [['user_id' => $this->sari->id, 'rsvp' => 'pending', 'optional' => false, 'called_at' => null]]);

        $this->actingAs($this->outsider)->getJson("{$this->base}/video/kehadiran{$this->q}")->assertNotFound();
    });

    it('calls a missing participant once per minute, notifies, audits and broadcasts', function () {
        Event::fake([MeetingRoomBroadcast::class]);

        $this->actingAs($this->sari)->postJson("{$this->base}/video/panggil/{$this->lukman->id}{$this->q}")
            ->assertOk()
            ->assertJsonPath('called.user_id', $this->lukman->id)
            ->assertJsonPath('called.called_by', $this->sari->id)
            ->assertJsonPath('called.called_at', '2026-10-12T02:05:00Z');

        Notification::assertSentTo($this->lukman, MeetingCalledNotification::class, function (MeetingCalledNotification $notification) {
            $payload = $notification->payload($this->lukman);

            return $payload->title === 'Rapat sudah dimulai — Gabung'
                && $payload->url === "{$this->base}/gabung?tanggal=2026-10-12"
                && str_starts_with((string) $payload->body, 'Sari Notulis memanggil Anda ke Rapat mingguan Operasional')
                && $payload->meta['open_label'] === 'Gabung';
        });
        expect(AuditLog::query()->where('action', 'meeting.video_participant_called')->sole()->new_values)
            ->toMatchArray(['occurrence_date' => '2026-10-12', 'user_id' => $this->lukman->id]);
        Event::assertDispatched(MeetingRoomBroadcast::class, fn (MeetingRoomBroadcast $event) => $event->name === 'participant.called' && $event->payload['user_id'] === $this->lukman->id);

        // Again within a minute (also by someone else) → 429 with retry_after.
        $this->travel(20)->seconds();
        $this->actingAs($this->dimas)->postJson("{$this->base}/video/panggil/{$this->lukman->id}{$this->q}")
            ->assertTooManyRequests()
            ->assertJsonPath('retry_after', 40)
            ->assertHeader('Retry-After', '40');

        // The panel shows when they were called; after a minute calling works again.
        $this->actingAs($this->nadia)->getJson("{$this->base}/video/kehadiran{$this->q}")
            ->assertJsonPath('not_joined.3.called_at', '2026-10-12T02:05:00Z');
        $this->travel(41)->seconds();
        $this->actingAs($this->dimas)->postJson("{$this->base}/video/panggil/{$this->lukman->id}{$this->q}")->assertOk();
        Notification::assertSentToTimes($this->lukman, MeetingCalledNotification::class, 2);
    });

    it('refuses callers who are not organizer or minute taker and targets that make no sense', function () {
        $this->actingAs($this->nadia)->postJson("{$this->base}/video/panggil/{$this->lukman->id}{$this->q}")->assertForbidden();
        $this->actingAs($this->outsider)->postJson("{$this->base}/video/panggil/{$this->lukman->id}{$this->q}")->assertNotFound();

        $this->actingAs($this->sari)->postJson("{$this->base}/video/panggil/{$this->sari->id}{$this->q}")->assertUnprocessable();
        $this->actingAs($this->sari)->postJson("{$this->base}/video/panggil/{$this->outsider->id}{$this->q}")
            ->assertUnprocessable()->assertJsonPath('errors.user.0', 'Orang ini tidak diundang ke rapat ini.');

        roomJoin($this->lukman, 1);
        $this->actingAs($this->sari)->postJson("{$this->base}/video/panggil/{$this->lukman->id}{$this->q}")
            ->assertUnprocessable()->assertJsonPath('errors.user.0', 'Lukman Hakim sudah ada di ruang rapat.');

        $this->actingAs($this->sari)->postJson("{$this->base}/video/panggil/{$this->nadia->id}?tanggal=2026-10-19")
            ->assertUnprocessable()->assertJsonPath('errors.user.0', 'Ruang rapat sedang tidak dibuka.');

        Notification::assertNothingSent();
    });
});

describe('policy, channel and broadcasts', function () {
    it('matches the callParticipant matrix', function () {
        $observer = User::factory()->withRole(Role::Direksi)->create();
        $leadership = Meeting::factory()->by($this->dimas)->video()->leadership()->at('2026-10-12 09:00')
            ->withParticipants([$this->nadia])->create(['minute_taker_id' => $this->sari->id]);

        expect(meetingVerdict($this->dimas, 'callParticipant', $this->meeting))->toBe('allow')
            ->and(meetingVerdict($this->sari, 'callParticipant', $this->meeting))->toBe('allow')
            ->and(meetingVerdict($this->nadia, 'callParticipant', $this->meeting))->toBe('deny')
            ->and(meetingVerdict($this->outsider, 'callParticipant', $this->meeting))->toBe('hidden')
            ->and(meetingVerdict($observer, 'callParticipant', $leadership))->toBe('deny');

        $this->meeting->forceFill(['canceled_at' => now()])->save();
        expect(meetingVerdict($this->sari, 'callParticipant', $this->meeting->fresh()))->toBe('deny');
    });

    it('authorizes the meeting channel for invited people of video meetings only', function () {
        $channel = fn (User $user, Meeting $meeting): bool => Gate::forUser($user)->allows('openVideo', $meeting);
        $meet = Meeting::factory()->by($this->dimas)->at('2026-10-12 13:00')->create();

        expect($channel($this->nadia, $this->meeting))->toBeTrue()
            ->and($channel($this->outsider, $this->meeting))->toBeFalse()
            ->and($channel($this->dimas, $meet))->toBeFalse();

        // Real auth request with the Reverb driver (nothing is broadcast from here on).
        config(['broadcasting.default' => 'reverb', 'broadcasting.connections.reverb.key' => 'k', 'broadcasting.connections.reverb.secret' => 's', 'broadcasting.connections.reverb.app_id' => 'a']);
        Broadcast::forgetDrivers();
        require base_path('routes/channels.php');
        $this->actingAs($this->nadia)->postJson('/broadcasting/auth', ['socket_id' => '1.1', 'channel_name' => 'private-meeting.'.$this->meeting->id])->assertOk();
        $this->actingAs($this->outsider)->postJson('/broadcasting/auth', ['socket_id' => '1.1', 'channel_name' => 'private-meeting.'.$this->meeting->id])->assertForbidden();
    });

    it('broadcasts minutes.updated for video meetings only, after saves and follow-up changes', function () {
        Event::fake([MeetingRoomBroadcast::class]);
        $occurrence = occurrenceOf($this->meeting, '2026-10-12');
        $content = ['attendance' => [], 'sections' => [['title' => 'Rekap stok', 'body' => 'Baru']], 'decisions' => []];

        app(SaveMinutes::class)->handle($occurrence, $this->sari, $content);
        app(SaveMinutes::class)->handle($occurrence, $this->sari, $content); // unchanged: nothing sent
        $this->actingAs($this->sari)->postJson("{$this->base}/tindak-lanjut{$this->q}", ['text' => 'Ajukan PO ban'])->assertCreated();

        Event::assertDispatchedTimes(MeetingRoomBroadcast::class, 2);
        Event::assertDispatched(MeetingRoomBroadcast::class, fn (MeetingRoomBroadcast $event) => $event->name === 'minutes.updated'
            && $event->payload['occurrence_date'] === '2026-10-12' && $event->payload['updated_by'] === $this->sari->id && $event->payload['status'] === 'draft');

        $meet = Meeting::factory()->by($this->dimas)->at('2026-10-12 13:00')->create();
        app(SaveMinutes::class)->handle(occurrenceOf($meet), $this->dimas, $content);
        Event::assertDispatchedTimes(MeetingRoomBroadcast::class, 2);
    });

    it('ignores the transcription agent in webhooks and broadcasts attendance changes', function () {
        Event::fake([MeetingRoomBroadcast::class]);
        $room = 'rk-'.strtolower($this->meeting->id).'-20261012';
        $event = fn (string $identity, string $sid): array => [
            'event' => 'participant_joined', 'room' => ['name' => $room],
            'participant' => ['sid' => $sid, 'identity' => $identity, 'joinedAt' => (string) now()->getTimestamp()],
        ];

        expect(app(RecordVideoEvent::class)->handle($event(RecordVideoEvent::AGENT_IDENTITY, 'PA_agent')))->toBeFalse()
            ->and(app(RecordVideoEvent::class)->handle($event($this->nadia->id, 'PA_n')))->toBeTrue()
            ->and(MeetingAttendance::query()->count())->toBe(1);

        Event::assertDispatched(MeetingRoomBroadcast::class, fn (MeetingRoomBroadcast $event) => $event->name === 'attendance.updated'
            && $event->payload === ['occurrence_date' => '2026-10-12', 'user_id' => $this->nadia->id, 'event' => 'joined']);
    });
});

describe('collaborative minutes', function () {
    beforeEach(function () {
        config(['features.notes' => true, 'collab.secret' => str_repeat('s', 40), 'collab.url' => 'http://collab.test', 'collab.public_url' => 'wss://collab.test']);
    });

    it('lets every invited person edit the room minutes, read-only for observers and final minutes', function () {
        $observer = User::factory()->withRole(Role::Direksi)->create();
        $this->meeting->forceFill(['leadership' => true])->save();

        $this->actingAs($this->nadia)->get("{$this->base}/ruang{$this->q}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('room.features.collab_minutes', true)
                ->where('room.minutes.mode', 'collab')
                ->where('room.minutes.collab.token_url', "{$this->base}/notulen/kolaborasi{$this->q}")
                ->where('room.minutes.collab.url', 'wss://collab.test')
                ->where('room.minutes.can_edit', true)
                ->where('room.minutes.can_edit_attendance', false)
                ->where('room.can.edit_minutes', true)
                ->where('room.can.choose_notes_source', false));

        $response = $this->actingAs($this->nadia)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")
            ->assertOk()->assertJsonPath('can_edit', true)->assertJsonPath('url', 'wss://collab.test');
        $minutes = MeetingMinutes::query()->where('meeting_id', $this->meeting->id)->whereDate('occurrence_date', '2026-10-12')->sole();
        expect($response->json('document'))->toBe('meeting-minutes.'.$minutes->id);

        // Same format as the notes tokens (collab/src/token.js), document name as `note`.
        [$body, $signature] = explode('.', (string) $response->json('token'));
        $payload = json_decode((string) base64_decode(strtr($body, '-_', '+/')), true);
        expect($signature)->toBe(rtrim(strtr(base64_encode(hash_hmac('sha256', $body, str_repeat('s', 40), true)), '+/', '-_'), '='))
            ->and($payload)->toMatchArray(['note' => 'meeting-minutes.'.$minutes->id, 'user' => $this->nadia->id, 'edit' => true]);

        $this->actingAs($observer)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")->assertOk()->assertJsonPath('can_edit', false);
        $this->actingAs($this->outsider)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")->assertNotFound();

        $minutes->forceFill(['status' => 'final', 'finalized_at' => now()])->save();
        $this->actingAs($this->sari)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")->assertJsonPath('can_edit', false);
    });

    it('is 503 without a collab server', function () {
        config(['collab.secret' => '']);

        $this->actingAs($this->nadia)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")->assertStatus(503);
    });

    it('loads and stores the document through the internal endpoints, mirroring the text', function () {
        Event::fake([MeetingRoomBroadcast::class]);
        $minutes = DB::transaction(fn () => app(MinutesStore::class)->open(occurrenceOf($this->meeting, '2026-10-12')));
        $secret = ['Authorization' => 'Bearer '.str_repeat('s', 40)];

        $this->getJson("/internal/rapat/notulen/{$minutes->id}/state", $secret)
            ->assertOk()
            ->assertJsonPath('yjs_state', null)
            ->assertJsonPath('content.content.0', ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => 'Rekap stok']]]);
        $this->getJson("/internal/rapat/notulen/{$minutes->id}/state")->assertUnauthorized();

        $doc = ['type' => 'doc', 'content' => [
            ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => 'Rekap stok']]],
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Selisih 0,8%']]],
            ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Palet lambat']]]]]]],
            ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => 'Keputusan']]],
            ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Servis AC dipindah']]]]]]],
        ]];

        $this->postJson("/internal/rapat/notulen/{$minutes->id}/state", [
            'yjs_state' => base64_encode('yjs-bytes'), 'body' => $doc, 'editor_ids' => [$this->nadia->id],
        ], $secret)->assertOk()->assertJsonPath('changed', true);

        $fresh = $minutes->fresh();
        expect($fresh->sections)->toEqual([['title' => 'Rekap stok', 'body' => "Selisih 0,8%\n• Palet lambat"]])
            ->and($fresh->decisions)->toBe(['Servis AC dipindah'])
            ->and($fresh->doc_state)->toBe('yjs-bytes')
            ->and($fresh->updated_by)->toBe($this->nadia->id)
            ->and($fresh->version)->toBe(1);
        Event::assertDispatched(MeetingRoomBroadcast::class, fn (MeetingRoomBroadcast $event) => $event->name === 'minutes.updated' && $event->payload['updated_by'] === $this->nadia->id);

        // Final minutes: accepted, nothing changes.
        $fresh->forceFill(['status' => 'final', 'finalized_at' => now()])->save();
        $this->postJson("/internal/rapat/notulen/{$minutes->id}/state", ['yjs_state' => base64_encode('x'), 'body' => ['type' => 'doc', 'content' => []], 'editor_ids' => []], $secret)
            ->assertOk()->assertJsonPath('changed', false);
        expect($minutes->fresh()->decisions)->toBe(['Servis AC dipindah']);
    });

    it('replaces the live document when the text is saved outside it, not for attendance only', function () {
        Http::fake(['collab.test/*' => Http::response(['loaded' => true])]);
        $occurrence = occurrenceOf($this->meeting, '2026-10-12');

        $this->actingAs($this->sari)->putJson("{$this->base}/notulen{$this->q}", [
            'attendance' => [['user_id' => $this->nadia->id, 'present' => true]],
            'sections' => [['title' => 'Rekap stok', 'body' => 'Baru']],
            'decisions' => [],
        ])->assertOk();

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/internal/documents/meeting-minutes.'.app(MinutesStore::class)->find($occurrence)?->id.'/replace')
            && $request['content']['content'][0]['content'][0]['text'] === 'Rekap stok');

        // Attendance only (room checklist while the text lives in Yjs): sections untouched, no replace.
        $this->actingAs($this->sari)->putJson("{$this->base}/notulen{$this->q}", [
            'attendance_only' => true,
            'attendance' => [['user_id' => $this->nadia->id, 'present' => false, 'reason' => 'sakit']],
        ])->assertOk()->assertJsonPath('minutes.sections.0.body', 'Baru')->assertJsonPath('minutes.attendance.0.reason', 'sakit');
        Http::assertSentCount(1);
    });
});

describe('editing hint and retention', function () {
    it('shows who is editing without collaboration and never blocks', function () {
        Event::fake([MeetingRoomBroadcast::class]);

        $this->actingAs($this->sari)->postJson("{$this->base}/notulen/menyunting{$this->q}", ['active' => true])
            ->assertOk()->assertJsonPath('editing.user_id', $this->sari->id)->assertJsonPath('editing.expires_at', '2026-10-12T02:05:30Z');
        $this->actingAs($this->dimas)->postJson("{$this->base}/notulen/menyunting{$this->q}", ['active' => true])
            ->assertOk()->assertJsonPath('editing.user_id', $this->sari->id);
        $this->actingAs($this->nadia)->postJson("{$this->base}/notulen/menyunting{$this->q}", ['active' => true])->assertForbidden();

        $this->actingAs($this->nadia)->get("{$this->base}/ruang{$this->q}")
            ->assertInertia(fn (Assert $page) => $page->where('room.minutes.editing.name', 'Sari Notulis'));

        // Expires 30 s after the last heartbeat; releasing hands it over at once.
        $this->actingAs($this->sari)->postJson("{$this->base}/notulen/menyunting{$this->q}", ['active' => false])->assertOk()->assertJsonPath('editing', null);
        $this->actingAs($this->dimas)->postJson("{$this->base}/notulen/menyunting{$this->q}", ['active' => true])->assertJsonPath('editing.user_id', $this->dimas->id);
        $this->travel(31)->seconds();
        $this->actingAs($this->sari)->postJson("{$this->base}/notulen/menyunting{$this->q}", ['active' => true])->assertJsonPath('editing.user_id', $this->sari->id);

        Event::assertDispatched(MeetingRoomBroadcast::class, fn (MeetingRoomBroadcast $event) => $event->name === 'minutes.editing' && $event->payload['editing'] === null);
    });

    it('purges speaking time with the transcript retention', function () {
        config(['livekit.speaking_retention_days' => 90]);
        MeetingSpeakingTime::query()->create(['meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-07-13', 'user_id' => $this->nadia->id, 'ms_spoken' => 10]);
        MeetingSpeakingTime::query()->create(['meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-07-14', 'user_id' => $this->nadia->id, 'ms_spoken' => 10]);

        expect((new PruneSpeakingTimes)->handle())->toBe(1)
            ->and(MeetingSpeakingTime::query()->sole()->occurrence_date->toDateString())->toBe('2026-07-14');
    });
});

describe('minutes document', function () {
    it('round-trips sections and decisions through the collaborative document', function () {
        $sections = [['title' => 'Rekap stok', 'body' => "Baris satu\n\n• poin"], ['title' => 'Kosong', 'body' => '']];
        $decisions = ['Keputusan A', 'Keputusan B'];

        expect(MinutesDocument::fromDoc(MinutesDocument::toDoc($sections, $decisions)))
            ->toBe(['sections' => $sections, 'decisions' => $decisions]);

        // Text before any heading is kept as "Catatan"; empty documents have nothing.
        expect(MinutesDocument::fromDoc(['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Bebas']]]]]))
            ->toBe(['sections' => [['title' => 'Catatan', 'body' => 'Bebas']], 'decisions' => []])
            ->and(MinutesDocument::fromDoc(null))->toBe(['sections' => [], 'decisions' => []]);
    });
});
