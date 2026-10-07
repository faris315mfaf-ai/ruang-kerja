<?php

use App\Domain\Meetings\Data\Occurrence;
use App\Domain\Meetings\Jobs\RemoveUserFromVideoRooms;
use App\Domain\Meetings\Services\LiveKitRoomService;
use App\Domain\Meetings\Services\LiveKitTokens;
use App\Domain\Meetings\Services\MeetingOccurrences;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Actions\DeactivateEmployee;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingVideoRemoval;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Security audit rapat 2026-10 (docs/security/AUDIT-RAPAT-2026-10.md):
 * R-04 removal block + re-admit, R-05 no self metadata (server-side raised
 * hand), R-08 mute audited, R-09 rooms closed on cancel / deactivation,
 * R-13 open-room index, R-15 admin token scope, R-07 webhook body limit,
 * lazy `detail` prop for the 30 s video poll.
 */
const HARDEN_SECRET = 'test-secret-that-is-at-least-32-characters';

function hardenClaims(string $token): object
{
    JWT::$timestamp = CarbonImmutable::now()->getTimestamp();

    try {
        return JWT::decode($token, new Key(HARDEN_SECRET, 'HS256'));
    } finally {
        JWT::$timestamp = null;
    }
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config([
        'features.meetings' => true,
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'http://livekit.internal:7880',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => HARDEN_SECRET,
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:05', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->meeting = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')->withParticipants([$this->rizky])->create();
    $this->room = 'rk-'.$this->meeting->id.'-20261005';
    $this->base = "/rapat/{$this->meeting->id}";
});

it('keeps a removed participant out of the occurrence until the organizer re-admits them (R-04)', function () {
    Http::fake(['livekit.internal:7880/*' => Http::response([])]);

    $this->actingAs($this->dimas)->deleteJson("{$this->base}/video/peserta/{$this->rizky->id}")->assertOk();
    $this->actingAs($this->rizky)->postJson("{$this->base}/video/token")
        ->assertForbidden()
        ->assertJsonPath('message', 'Penyelenggara mengeluarkan Anda dari rapat ini.');
    $this->actingAs($this->rizky)->postJson("{$this->base}/video/bicara", ['ms' => 0])->assertForbidden();

    $this->actingAs($this->dimas)->getJson("{$this->base}/video/kehadiran")
        ->assertJsonPath('removed.0.user_id', $this->rizky->id)
        ->assertJsonPath('removed.0.removed_by', $this->dimas->id);

    // Only the organizer re-admits; it is audited and the token works again.
    $this->actingAs($this->rizky)->deleteJson("{$this->base}/video/peserta/{$this->rizky->id}/larangan")->assertForbidden();
    $this->actingAs($this->dimas)->deleteJson("{$this->base}/video/peserta/{$this->rizky->id}/larangan")
        ->assertOk()->assertJsonPath('readmitted', true);
    $this->actingAs($this->rizky)->postJson("{$this->base}/video/token")->assertOk();

    expect(MeetingVideoRemoval::query()->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'meeting.video_participant_readmitted')->sole()->new_values)
        ->toMatchArray(['user_id' => $this->rizky->id, 'occurrence_date' => '2026-10-05']);
});

it('blocks only that occurrence and keeps the block when LiveKit fails', function () {
    Http::fake(['livekit.internal:7880/*' => Http::response(['code' => 'unavailable'], 503)]);

    $this->actingAs($this->dimas)->deleteJson("{$this->base}/video/peserta/{$this->rizky->id}")->assertStatus(502);

    expect(MeetingVideoRemoval::query()->sole()->occurrence_date->toDateString())->toBe('2026-10-05');
});

it('gives no token grant to change one\'s own name or metadata; the hand is raised server-side (R-05)', function () {
    Http::fake(['livekit.internal:7880/*' => Http::response([])]);

    $token = $this->actingAs($this->rizky)->postJson("{$this->base}/video/token")->assertOk()->json('token');
    $grant = (array) hardenClaims((string) $token)->video;
    expect($grant)->not->toHaveKey('canUpdateOwnMetadata')
        ->and($grant)->not->toHaveKey('roomAdmin');

    $this->actingAs($this->rizky)->postJson("{$this->base}/video/tangan", ['raised' => true])
        ->assertOk()->assertJsonPath('hand', (string) now()->getTimestampMs());
    $this->actingAs($this->rizky)->postJson("{$this->base}/video/tangan", ['raised' => false])
        ->assertOk()->assertJsonPath('hand', '');

    Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/twirp/livekit.RoomService/UpdateParticipant')
        && $request['room'] === $this->room && $request['identity'] === $this->rizky->id && $request['attributes'] === ['hand' => '']);

    $outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->actingAs($outsider)->postJson("{$this->base}/video/tangan", ['raised' => true])->assertNotFound();

    // Whitelisted own attributes (section presence, opt-out mirror); never a name or anything else.
    $this->actingAs($this->rizky)->postJson("{$this->base}/video/atribut", ['attributes' => ['rk_minutes_at' => 'section-2', 'rk_notulen_optout' => '1']])
        ->assertOk()->assertJsonPath('attributes', ['rk_minutes_at' => 'section-2', 'rk_notulen_optout' => '1']);
    $this->actingAs($this->rizky)->postJson("{$this->base}/video/atribut", ['attributes' => ['name' => 'Direktur Utama']])->assertUnprocessable();
    $this->actingAs($this->rizky)->postJson("{$this->base}/video/atribut", ['attributes' => ['hand' => 'abc']])->assertUnprocessable();
    $this->actingAs($outsider)->postJson("{$this->base}/video/atribut", ['attributes' => ['hand' => '']])->assertNotFound();
});

it('audits muting like removing (R-08)', function () {
    Http::fake(['livekit.internal:7880/*' => Http::response([])]);

    $this->actingAs($this->dimas)->postJson("{$this->base}/video/peserta/{$this->rizky->id}/bisukan", ['track_sid' => 'TR_mic1'])->assertOk();

    expect(AuditLog::query()->where('action', 'meeting.video_participant_muted')->sole()->new_values)
        ->toMatchArray(['identity' => $this->rizky->id, 'track_sid' => 'TR_mic1', 'occurrence_date' => '2026-10-05']);
});

it('closes the live rooms when a video meeting is canceled (R-09)', function () {
    Http::fake(['livekit.internal:7880/*' => Http::response([])]);
    MeetingAttendance::query()->create([
        'meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-10-05', 'user_id' => $this->rizky->id,
        'room' => $this->room, 'participant_sid' => 'PA_r', 'joined_at' => now()->subMinutes(3),
    ]);

    $this->actingAs($this->dimas)->delete($this->base)->assertRedirect();

    Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/twirp/livekit.RoomService/DeleteRoom') && $request['room'] === $this->room);
    Http::assertSentCount(1);
    $this->actingAs($this->rizky)->postJson("{$this->base}/video/token")->assertForbidden();
});

it('refuses tokens to deactivated accounts and removes them from rooms they are in (R-09)', function () {
    Queue::fake([RemoveUserFromVideoRooms::class]);
    $hr = User::factory()->withRole(Role::Hr)->create();
    MeetingAttendance::query()->create([
        'meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-10-05', 'user_id' => $this->rizky->id,
        'room' => $this->room, 'participant_sid' => 'PA_r', 'joined_at' => now()->subMinutes(3),
    ]);

    app(DeactivateEmployee::class)->handle($hr, $this->rizky, UserStatus::Inactive, 'Kontrak selesai');

    Queue::assertPushed(RemoveUserFromVideoRooms::class, fn (RemoveUserFromVideoRooms $job) => $job->userId === $this->rizky->id);

    Http::fake(['livekit.internal:7880/*' => Http::response([])]);
    expect((new RemoveUserFromVideoRooms($this->rizky->id))->handle(app(VideoRooms::class), app(LiveKitRoomService::class)))->toBe(1);
    Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/RemoveParticipant') && $request['identity'] === $this->rizky->id);

    expect(Gate::forUser($this->rizky->fresh())->inspect('joinVideo', [$this->meeting, occurrenceOfHardening($this->meeting)])->allowed())->toBeFalse();
});

it('indexes open attendance rows per room and scopes the admin token to one room (R-13, R-15)', function () {
    $index = DB::selectOne("select indexdef from pg_indexes where indexname = 'meeting_attendances_open_room_index'");
    expect($index?->indexdef)->toContain('(room)')->toContain('left_at IS NULL');

    $claims = hardenClaims(app(LiveKitTokens::class)->adminToken($this->room));
    expect((array) $claims->video)->toBe(['room' => $this->room, 'roomAdmin' => true]);
});

it('rejects webhook bodies over 64 KB before decoding them (R-07)', function () {
    $body = json_encode(['event' => 'participant_joined', 'pad' => str_repeat('x', 70 * 1024)], JSON_THROW_ON_ERROR);

    $this->call('POST', '/api/livekit/webhook', [], [], [], ['CONTENT_TYPE' => 'application/webhook+json', 'CONTENT_LENGTH' => (string) strlen($body)], $body)
        ->assertStatus(413);

    // The global TrimStrings middleware leaves the webhook body alone (no json decode).
    $request = Request::create('/api/livekit/webhook', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/webhook+json'], '{"a":"  x  "}');
    $other = Request::create('/rapat', 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json'], '{"a":"  x  "}');
    $seen = [];
    $middleware = app(TrimStrings::class);
    $middleware->handle($request, function (Request $passed) use (&$seen) {
        $seen[] = $passed->json('a');

        return response('');
    });
    $middleware->handle($other, function (Request $passed) use (&$seen) {
        $seen[] = $passed->json('a');

        return response('');
    });

    expect($seen)->toBe(['  x  ', 'x']);
});

it('computes the detail prop only on full visits, not on the video poll', function () {
    $this->actingAs($this->rizky)->get($this->base)
        ->assertInertia(fn (Assert $page) => $page
            ->has('detail.meeting')
            ->reloadOnly('video', fn (Assert $reload) => $reload->missing('detail')->has('video.attendance')));
});

function occurrenceOfHardening(Meeting $meeting): Occurrence
{
    return app(MeetingOccurrences::class)->resolve($meeting->fresh() ?? $meeting, null);
}
