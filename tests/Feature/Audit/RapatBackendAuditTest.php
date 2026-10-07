<?php

use App\Domain\Meetings\Actions\ReportSpeakingTime;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Organization\Enums\Role;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingMinutes;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
 * Audit rapat 2026-10, fase 2 (docs/security/AUDIT-RAPAT-2026-10.md §7,
 * branch claude/rapat-backend): speaking-time inflation (B-01), removal
 * bypass through the collaborative minutes (B-02), raised-hand order
 * spoofing (B-03).
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config([
        'features.meetings' => true,
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'http://livekit.internal:7880',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => 'test-secret-that-is-at-least-32-characters',
        'collab.secret' => '',
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-12 09:05', 'Asia/Jakarta'));
    $this->organizer = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->nadia = User::factory()->withRole(Role::Anggota)->create();
    $this->lukman = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->organizer)->video()->at('2026-10-05 09:00')
        ->recurring(Recurrence::Weekly)
        ->withParticipants([$this->nadia, $this->lukman])
        ->create();
    $this->base = "/rapat/{$this->meeting->id}";
    $this->q = '?tanggal=2026-10-12';
    $this->room = 'rk-'.strtolower($this->meeting->id).'-20261012';
});

function auditRoomSession(User $user, CarbonImmutable $joined, ?CarbonImmutable $left = null): void
{
    MeetingAttendance::query()->create([
        'meeting_id' => test()->meeting->id, 'occurrence_date' => '2026-10-12', 'user_id' => $user->id,
        'room' => test()->room, 'participant_sid' => 'PA_'.bin2hex(random_bytes(4)),
        'joined_at' => $joined, 'left_at' => $left,
        'duration_seconds' => $left === null ? null : (int) $joined->diffInSeconds($left),
    ]);
}

/** Reports the maximum every 3 s (route limit 20/min) for $seconds; returns the last accepted total. */
function auditFloodSpeaking(User $user, int $seconds): int
{
    $occurrence = occurrenceOf(test()->meeting, '2026-10-12');
    $report = app(ReportSpeakingTime::class);
    $accepted = 0;

    for ($t = 0; $t <= $seconds; $t += 3) {
        $accepted = $report->handle($occurrence, $user, ReportSpeakingTime::MAX_MS);
        test()->travel(3)->seconds();
    }

    return $accepted;
}

describe('B-01 speaking time cannot outgrow time in the room', function () {
    it('caps someone who never entered the LiveKit room at the first-report allowance', function () {
        // Five minutes of flooding without ever joining (no webhook attendance).
        expect(auditFloodSpeaking($this->nadia, 300))->toBe(ReportSpeakingTime::FIRST_REPORT_MAX_MS);
    });

    it('stops counting once the person has left the room', function () {
        $now = CarbonImmutable::now();
        auditRoomSession($this->nadia, $now->subMinutes(2), $now->subMinute());

        // One minute in the room, then ten minutes of reports from outside.
        expect(auditFloodSpeaking($this->nadia, 600))->toBeLessThanOrEqual(60_000 + ReportSpeakingTime::SLACK_MS);
    });

    it('still counts real time while the person is in the room', function () {
        auditRoomSession($this->nadia, CarbonImmutable::now()->subMinute());

        $accepted = auditFloodSpeaking($this->nadia, 120);

        // ~3 minutes in the room by the end: plausible values are accepted, never more than that.
        expect($accepted)->toBeGreaterThan(150_000)->toBeLessThanOrEqual(186_000 + ReportSpeakingTime::SLACK_MS);
    });
});

describe('B-02 a removed participant is also out of the collaborative minutes', function () {
    beforeEach(function () {
        config(['features.notes' => true, 'collab.secret' => str_repeat('s', 40), 'collab.url' => 'http://collab.test', 'collab.public_url' => 'wss://collab.test']);
        Http::fake(['*' => Http::response([], 200)]);
    });

    it('gives a read-only collab token after the removal and forces editors to reconnect', function () {
        $this->actingAs($this->nadia)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")->assertJsonPath('can_edit', true);
        $minutes = MeetingMinutes::query()->where('meeting_id', $this->meeting->id)->whereDate('occurrence_date', '2026-10-12')->sole();

        $this->actingAs($this->organizer)->deleteJson("{$this->base}/video/peserta/{$this->nadia->id}{$this->q}")->assertOk();

        $this->actingAs($this->nadia)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")->assertJsonPath('can_edit', false);
        $this->actingAs($this->nadia)->get("{$this->base}/ruang{$this->q}")->assertOk()
            ->assertInertia(fn ($page) => $page->where('room.minutes.can_edit', false));
        Http::assertSent(fn (ClientRequest $request) => $request->url() === "http://collab.test/internal/documents/meeting-minutes.{$minutes->id}/reconnect");

        // Other participants keep editing; re-admitted, Nadia edits again.
        $this->actingAs($this->lukman)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")->assertJsonPath('can_edit', true);
        $this->actingAs($this->organizer)->deleteJson("{$this->base}/video/peserta/{$this->nadia->id}/larangan{$this->q}")->assertOk();
        $this->actingAs($this->nadia)->getJson("{$this->base}/notulen/kolaborasi{$this->q}")->assertJsonPath('can_edit', true);
    });
});

describe('B-03 raised-hand order', function () {
    it('stamps a raised hand with the server time even through the attributes endpoint', function () {
        Http::fake(['livekit.internal:7880/twirp/*' => Http::response([], 200)]);

        $this->actingAs($this->nadia)
            ->postJson("{$this->base}/video/atribut{$this->q}", ['attributes' => ['hand' => '1000000000000']])
            ->assertOk()
            ->assertJsonPath('attributes.hand', (string) CarbonImmutable::now()->getTimestampMs());

        $this->actingAs($this->nadia)
            ->postJson("{$this->base}/video/atribut{$this->q}", ['attributes' => ['hand' => '']])
            ->assertOk()
            ->assertJsonPath('attributes.hand', '');

        Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/UpdateParticipant')
            && $request['attributes']['hand'] === (string) CarbonImmutable::now()->getTimestampMs());
    });
});
