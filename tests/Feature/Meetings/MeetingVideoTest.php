<?php

use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Domain\Meetings\Notifications\MeetingStartingNotification;
use App\Domain\Meetings\Services\LiveKitTokens;
use App\Domain\Meetings\Services\MinutesStore;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
 * Video RuangKerja (LiveKit): token endpoint + JWT claims, join window,
 * pre-join/room pages, signed webhooks → attendance, organizer moderation
 * (Room Service API faked), minutes prefill and the "Gabung" notification.
 */
const LK_KEY = 'devkey';
const LK_SECRET = 'test-secret-that-is-at-least-32-characters';

function configureLiveKit(): void
{
    config([
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'http://livekit.internal:7880',
        'livekit.api_key' => LK_KEY,
        'livekit.api_secret' => LK_SECRET,
        'livekit.token_ttl' => 600,
    ]);
}

/**
 * @return object claims of a JWT signed with the test secret (app clock)
 */
function decodeLiveKitJwt(string $token): object
{
    JWT::$timestamp = CarbonImmutable::now()->getTimestamp();

    try {
        return JWT::decode($token, new Key(LK_SECRET, 'HS256'));
    } finally {
        JWT::$timestamp = null;
    }
}

/**
 * Signed webhook request like LiveKit's notifier (Authorization = JWT with sha256 of the body).
 *
 * @param  array<string, mixed>  $event
 */
function postLiveKitWebhook(array $event, ?string $secret = null, ?string $tamperedBody = null, ?int $issuedAt = null)
{
    $body = json_encode($event, JSON_THROW_ON_ERROR);
    $now = $issuedAt ?? CarbonImmutable::now()->getTimestamp();
    $token = JWT::encode([
        'iss' => LK_KEY,
        'nbf' => $now,
        'exp' => $now + 300,
        'sha256' => base64_encode(hash('sha256', $body, true)),
    ], $secret ?? LK_SECRET, 'HS256');

    return test()->call('POST', '/api/livekit/webhook', [], [], [], [
        'HTTP_AUTHORIZATION' => $token,
        'CONTENT_TYPE' => 'application/webhook+json',
    ], $tamperedBody ?? $body);
}

/**
 * @return array<string, mixed>
 */
function liveKitEvent(string $type, string $room, string $identity, string $sid, ?int $at = null, ?string $id = null): array
{
    $at ??= CarbonImmutable::now()->getTimestamp();

    return [
        'event' => $type,
        'id' => $id ?? 'EV_'.bin2hex(random_bytes(6)),
        'createdAt' => (string) $at,
        'room' => ['sid' => 'RM_test', 'name' => $room],
        'participant' => ['sid' => $sid, 'identity' => $identity, 'name' => 'Nama', 'joinedAt' => (string) $at],
    ];
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config(['features.meetings' => true]);
    configureLiveKit();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:50', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->taker = User::factory()->withRole(Role::Anggota)->create(['name' => 'Sari Notulis']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->foreign = User::factory()->withRole(Role::Anggota)->create(['company_id' => Company::factory()->create()->id]);
    $this->meeting = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')
        ->withParticipants([$this->rizky, $this->taker])
        ->create(['title' => 'Sinkron mingguan', 'minute_taker_id' => $this->taker->id]);
    $this->room = 'rk-'.$this->meeting->id.'-20261005';
});

describe('token endpoint', function () {
    it('authorizes by role, company and feature', function (string $actor, int $status) {
        $user = match ($actor) {
            'organizer' => $this->dimas,
            'participant' => $this->rizky,
            'minute taker' => $this->taker,
            'non-participant' => $this->outsider,
            'other company' => $this->foreign,
        };

        $this->actingAs($user)->postJson("/rapat/{$this->meeting->id}/video/token")->assertStatus($status);
    })->with([
        'organizer' => ['organizer', 200],
        'participant' => ['participant', 200],
        'minute taker' => ['minute taker', 200],
        'non-participant' => ['non-participant', 404],
        'other company' => ['other company', 404],
    ]);

    it('refuses leadership observers who were not invited', function () {
        $direksi = User::factory()->withRole(Role::Direksi)->create();
        $this->meeting->update(['leadership' => true]);

        $this->actingAs($direksi)->postJson("/rapat/{$this->meeting->id}/video/token")
            ->assertForbidden()
            ->assertJsonPath('message', 'Anda tidak diundang ke rapat ini.');
    });

    it('returns url, token, room, identity and name with LiveKit claims', function () {
        $response = $this->actingAs($this->rizky)->postJson("/rapat/{$this->meeting->id}/video/token")
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('url', 'wss://rapat.example.test')
            ->assertJsonPath('room', $this->room)
            ->assertJsonPath('identity', $this->rizky->id)
            ->assertJsonPath('name', 'Rizky Aditya');

        $claims = decodeLiveKitJwt($response->json('token'));
        $now = CarbonImmutable::now()->getTimestamp();

        expect($claims->iss)->toBe(LK_KEY)
            ->and($claims->sub)->toBe($this->rizky->id)
            ->and($claims->name)->toBe('Rizky Aditya')
            ->and($claims->exp - $now)->toBe(600)
            ->and($claims->nbf)->toBeLessThanOrEqual($now)
            ->and($claims->video->room)->toBe($this->room)
            ->and($claims->video->roomJoin)->toBeTrue()
            ->and($claims->video->canPublish)->toBeTrue()
            ->and($claims->video->canSubscribe)->toBeTrue()
            ->and($claims->video->canPublishData)->toBeTrue()
            ->and(property_exists($claims->video, 'roomAdmin'))->toBeFalse()
            ->and(json_decode($claims->metadata, true))->toMatchArray(['organizer' => false]);
    });

    it('gives the organizer roomAdmin', function () {
        $token = $this->actingAs($this->dimas)->postJson("/rapat/{$this->meeting->id}/video/token")->json('token');

        $claims = decodeLiveKitJwt($token);

        expect($claims->video->roomAdmin)->toBeTrue()
            ->and(json_decode($claims->metadata, true)['organizer'])->toBeTrue();
    });

    it('rejects a token signed with another secret', function () {
        $token = $this->actingAs($this->dimas)->postJson("/rapat/{$this->meeting->id}/video/token")->json('token');

        JWT::$timestamp = CarbonImmutable::now()->getTimestamp();
        expect(fn () => JWT::decode($token, new Key('another-secret-that-is-32-characters-long', 'HS256')))
            ->toThrow(Exception::class);
        JWT::$timestamp = null;
    });

    it('opens 15 minutes before the start until 2 hours after the end, organizer any time', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 09:44', 'Asia/Jakarta'));
        $this->actingAs($this->rizky)->postJson("/rapat/{$this->meeting->id}/video/token")
            ->assertForbidden()
            ->assertJsonPath('message', 'Ruang rapat dibuka pukul 09.45.');
        $this->actingAs($this->dimas)->postJson("/rapat/{$this->meeting->id}/video/token")->assertOk();

        $this->travelTo(CarbonImmutable::parse('2026-10-05 09:45', 'Asia/Jakarta'));
        $this->actingAs($this->rizky)->postJson("/rapat/{$this->meeting->id}/video/token")->assertOk();

        $this->travelTo(CarbonImmutable::parse('2026-10-05 13:00', 'Asia/Jakarta'));
        $this->actingAs($this->rizky)->postJson("/rapat/{$this->meeting->id}/video/token")->assertOk();

        $this->travelTo(CarbonImmutable::parse('2026-10-05 13:01', 'Asia/Jakarta'));
        $this->actingAs($this->rizky)->postJson("/rapat/{$this->meeting->id}/video/token")
            ->assertForbidden()
            ->assertJsonPath('message', 'Rapat sudah selesai. Ruang rapat sudah ditutup.');
        $this->actingAs($this->dimas)->postJson("/rapat/{$this->meeting->id}/video/token")->assertOk();
    });

    it('uses one room per occurrence of a series', function () {
        $series = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')
            ->recurring(Recurrence::Weekdays)->withParticipants([$this->rizky])->create();

        $this->actingAs($this->rizky)->postJson("/rapat/{$series->id}/video/token", ['tanggal' => '2026-10-05'])
            ->assertOk()->assertJsonPath('room', 'rk-'.$series->id.'-20261005');

        // Tomorrow's room is not open yet for a participant.
        $this->actingAs($this->rizky)->postJson("/rapat/{$series->id}/video/token", ['tanggal' => '2026-10-06'])
            ->assertForbidden();
        $this->actingAs($this->dimas)->postJson("/rapat/{$series->id}/video/token", ['tanggal' => '2026-10-06'])
            ->assertOk()->assertJsonPath('room', 'rk-'.$series->id.'-20261006');
    });

    it('is 404 for meetings without the video platform, 403 when canceled', function () {
        $meet = Meeting::factory()->by($this->dimas)->at('2026-10-05 10:00')->withParticipants([$this->rizky])->create();
        $this->actingAs($this->rizky)->postJson("/rapat/{$meet->id}/video/token")->assertNotFound();

        $this->meeting->update(['canceled_at' => now()]);
        $this->actingAs($this->rizky)->postJson("/rapat/{$this->meeting->id}/video/token")
            ->assertForbidden()->assertJsonPath('message', 'Rapat ini sudah dibatalkan.');
    });

    it('answers 404 when the feature is off and 503 when LiveKit is not configured', function () {
        config(['livekit.api_secret' => null]);
        $this->actingAs($this->rizky)->postJson("/rapat/{$this->meeting->id}/video/token")
            ->assertStatus(503)
            ->assertJsonPath('message', 'Video RuangKerja belum disiapkan di server ini. Hubungi admin.');

        config(['features.meetings' => false]);
        $this->actingAs($this->rizky)->postJson("/rapat/{$this->meeting->id}/video/token")->assertNotFound();
    });

    it('requires a session', function () {
        $this->postJson("/rapat/{$this->meeting->id}/video/token")->assertUnauthorized();
    });
});

describe('pages', function () {
    it('renders the pre-join and room pages for participants', function (string $path, string $component) {
        $this->actingAs($this->rizky)->get("/rapat/{$this->meeting->id}/{$path}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component($component)
                ->where('room.viewer.id', $this->rizky->id)
                ->where('room.meeting.title', 'Sinkron mingguan')
                ->where('room.meeting.occurrence_date', '2026-10-05')
                ->where('room.video.configured', true)
                ->where('room.video.can_join', true)
                ->where('room.video.is_organizer', false)
                ->where('room.video.join_href', "/rapat/{$this->meeting->id}/gabung")
                ->where('room.video.room_href', "/rapat/{$this->meeting->id}/ruang")
                ->where('room.video.opens_at', '2026-10-05T02:45:00Z')
                ->where('room.video.closes_at', '2026-10-05T06:00:00Z')
                ->where('room.video.in_room', 0)
                ->has('room.people', 3));

        $this->actingAs($this->outsider)->get("/rapat/{$this->meeting->id}/{$path}")->assertNotFound();
    })->with([
        'pre-join' => ['gabung', 'meetings/join'],
        'room' => ['ruang', 'meetings/room'],
    ]);

    it('still renders with a note flag when LiveKit is not configured', function () {
        config(['livekit.url' => null]);

        $this->actingAs($this->rizky)->get("/rapat/{$this->meeting->id}/gabung")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('room.video.configured', false));
    });

    it('adds the video summary to the meeting detail and offers the platform in the form', function () {
        $this->actingAs($this->rizky)->get("/rapat/{$this->meeting->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('detail.meeting.platform', 'video')
                ->where('video.configured', true)
                ->where('video.can_join', true));

        $meet = Meeting::factory()->by($this->dimas)->withParticipants([$this->rizky])->create();
        $this->actingAs($this->rizky)->get("/rapat/{$meet->id}")
            ->assertInertia(fn (Assert $page) => $page->where('video', null));

        $this->actingAs($this->dimas)->get('/rapat/baru')
            ->assertInertia(fn (Assert $page) => $page->where('form.video_enabled', true));

        config(['livekit.url' => null]);
        $this->actingAs($this->dimas)->get('/rapat/baru')
            ->assertInertia(fn (Assert $page) => $page->where('form.video_enabled', false));
    });

    it('schedules a video meeting without a link, only when LiveKit is configured', function () {
        $this->actingAs($this->dimas)->post('/rapat', meetingPayload([
            'platform' => 'video',
            'join_url' => 'https://meet.google.com/abc-defg-hij',
            'participant_ids' => [$this->rizky->id],
        ]))->assertRedirect();

        $meeting = Meeting::query()->latest('created_at')->latest('id')->firstOrFail();
        expect($meeting->platform->value)->toBe('video')->and($meeting->join_url)->toBeNull();

        config(['livekit.api_key' => null]);
        $this->actingAs($this->dimas)->post('/rapat', meetingPayload([
            'platform' => 'video',
            'participant_ids' => [$this->rizky->id],
        ]))->assertSessionHasErrors(['platform' => 'Video RuangKerja belum disiapkan di server ini. Pilih Google Meet atau Zoom.']);
    });
});

describe('webhook', function () {
    it('records join and leave with duration and shows it on the detail page', function () {
        $joined = CarbonImmutable::parse('2026-10-05 10:00', 'Asia/Jakarta');
        $this->travelTo($joined);
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->rizky->id, 'PA_rizky1'))
            ->assertOk()->assertJsonPath('status', 'recorded');

        $this->actingAs($this->dimas)->get("/rapat/{$this->meeting->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('video.in_room', 1)
                ->where('video.attendance.0.user_id', $this->rizky->id)
                ->where('video.attendance.0.in_room', true));

        $this->travelTo($joined->addMinutes(42));
        postLiveKitWebhook(liveKitEvent('participant_left', $this->room, $this->rizky->id, 'PA_rizky1'))
            ->assertOk()->assertJsonPath('status', 'recorded');

        $row = MeetingAttendance::query()->sole();
        expect($row->user_id)->toBe($this->rizky->id)
            ->and($row->occurrence_date->toDateString())->toBe('2026-10-05')
            ->and($row->duration_seconds)->toBe(42 * 60)
            ->and($row->left_at?->toIso8601ZuluString())->toBe('2026-10-05T03:42:00Z');

        $this->actingAs($this->dimas)->get("/rapat/{$this->meeting->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('video.in_room', 0)
                ->where('video.attendance.0.duration_seconds', 42 * 60)
                ->where('video.attendance.0.left_at', '2026-10-05T03:42:00Z'));
    });

    it('sums sessions after a reconnect and closes open rows when the room finishes', function () {
        $start = CarbonImmutable::parse('2026-10-05 10:00', 'Asia/Jakarta');
        $this->travelTo($start);
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->rizky->id, 'PA_a'));
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->dimas->id, 'PA_d'));
        $this->travelTo($start->addMinutes(10));
        postLiveKitWebhook(liveKitEvent('participant_left', $this->room, $this->rizky->id, 'PA_a'));
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->rizky->id, 'PA_b'));
        $this->travelTo($start->addMinutes(30));
        postLiveKitWebhook(['event' => 'room_finished', 'id' => 'EV_fin', 'createdAt' => (string) now()->getTimestamp(), 'room' => ['name' => $this->room]])
            ->assertJsonPath('status', 'recorded');

        expect(MeetingAttendance::query()->whereNull('left_at')->count())->toBe(0);

        $this->actingAs($this->dimas)->get("/rapat/{$this->meeting->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('video.attendance.0.user_id', $this->rizky->id)
                ->where('video.attendance.0.duration_seconds', 30 * 60)
                ->where('video.attendance.0.sessions', 2)
                ->where('video.attendance.1.user_id', $this->dimas->id)
                ->where('video.attendance.1.duration_seconds', 30 * 60));
    });

    it('rejects invalid signatures, tampered bodies and wrong keys', function () {
        $event = liveKitEvent('participant_joined', $this->room, $this->rizky->id, 'PA_x');

        postLiveKitWebhook($event, secret: 'wrong-secret-that-is-also-32-characters')->assertUnauthorized();
        postLiveKitWebhook($event, tamperedBody: json_encode([...$event, 'room' => ['name' => 'rk-other']]))->assertUnauthorized();
        $this->call('POST', '/api/livekit/webhook', [], [], [], ['CONTENT_TYPE' => 'application/webhook+json'], json_encode($event))
            ->assertUnauthorized();

        expect(MeetingAttendance::query()->count())->toBe(0);
    });

    it('ignores replays: the same event id once, expired tokens and stale events', function () {
        $event = liveKitEvent('participant_joined', $this->room, $this->rizky->id, 'PA_r', id: 'EV_same');

        postLiveKitWebhook($event)->assertJsonPath('status', 'recorded');
        postLiveKitWebhook($event)->assertOk()->assertJsonPath('status', 'duplicate');
        expect(MeetingAttendance::query()->count())->toBe(1);

        // A captured request replayed after its token expired.
        $old = CarbonImmutable::now()->subMinutes(10)->getTimestamp();
        postLiveKitWebhook(liveKitEvent('participant_left', $this->room, $this->rizky->id, 'PA_r', $old), issuedAt: $old)
            ->assertUnauthorized();

        // A fresh signature over an old event.
        postLiveKitWebhook(liveKitEvent('participant_left', $this->room, $this->rizky->id, 'PA_r', $old))
            ->assertStatus(422);

        expect(MeetingAttendance::query()->sole()->left_at)->toBeNull();
    });

    it('ignores unknown rooms, other meetings, foreign identities and the transcription agent', function () {
        postLiveKitWebhook(liveKitEvent('participant_joined', 'some-room', $this->rizky->id, 'PA_1'))->assertJsonPath('status', 'ignored');
        postLiveKitWebhook(liveKitEvent('participant_joined', 'rk-'.$this->meeting->id.'-20261006', $this->rizky->id, 'PA_2'))->assertJsonPath('status', 'ignored');
        $meet = Meeting::factory()->by($this->dimas)->at('2026-10-05 10:00')->create();
        postLiveKitWebhook(liveKitEvent('participant_joined', 'rk-'.$meet->id.'-20261005', $this->rizky->id, 'PA_3'))->assertJsonPath('status', 'ignored');

        // Not an employee of the meeting's company, the transcription agent, a guest: no attendance row.
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->foreign->id, 'PA_4'))->assertJsonPath('status', 'ignored');
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, 'rk-notulen', 'PA_5'))->assertJsonPath('status', 'ignored');
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, 'tamu@contoh.id', 'PA_6'))->assertJsonPath('status', 'ignored');
        expect(MeetingAttendance::query()->count())->toBe(0);
    });

    it('is not reachable when LiveKit is not configured or the feature is off', function () {
        config(['livekit.api_secret' => null]);
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->rizky->id, 'PA_1'))->assertNotFound();

        configureLiveKit();
        config(['features.meetings' => false]);
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->rizky->id, 'PA_1'))->assertNotFound();
    });

    it('verifies the signature with the shared service as LiveKit sends it (no Bearer prefix)', function () {
        $body = '{"event":"room_started"}';
        $token = JWT::encode(['iss' => LK_KEY, 'exp' => now()->getTimestamp() + 60, 'sha256' => base64_encode(hash('sha256', $body, true))], LK_SECRET, 'HS256');
        $tokens = app(LiveKitTokens::class);

        expect($tokens->verifyWebhook($body, $token))->not->toBeNull()
            ->and($tokens->verifyWebhook($body, 'Bearer '.$token))->not->toBeNull()
            ->and($tokens->verifyWebhook($body.' ', $token))->toBeNull()
            ->and($tokens->verifyWebhook($body, null))->toBeNull();

        $wrongIssuer = JWT::encode(['iss' => 'other', 'exp' => now()->getTimestamp() + 60, 'sha256' => base64_encode(hash('sha256', $body, true))], LK_SECRET, 'HS256');
        expect($tokens->verifyWebhook($body, $wrongIssuer))->toBeNull();
    });
});

describe('attendance in minutes and notifications', function () {
    it('prefills the minutes attendance from who joined the video room', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00', 'Asia/Jakarta'));
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->dimas->id, 'PA_d'));
        postLiveKitWebhook(liveKitEvent('participant_joined', $this->room, $this->taker->id, 'PA_t'));

        $blank = app(MinutesStore::class)->blank(occurrenceOf($this->meeting));
        $present = collect($blank['attendance'])->mapWithKeys(fn (array $mark) => [$mark['user_id'] => $mark['present']])->all();

        expect($present)->toBe([
            $this->dimas->id => true,
            $this->rizky->id => false,
            $this->taker->id => true,
        ]);
    });

    it('keeps the RSVP-based attendance when nobody used the room', function () {
        $blank = app(MinutesStore::class)->blank(occurrenceOf($this->meeting));

        expect(collect($blank['attendance'])->pluck('present')->unique()->all())->toBe([true]);
    });

    it('links the "starting" notification of a video meeting to the pre-join screen', function () {
        $payload = (new MeetingStartingNotification($this->meeting, '2026-10-05', 5))->payload($this->rizky);

        expect($payload->url)->toBe("/rapat/{$this->meeting->id}/gabung")
            ->and($payload->meta['open_label'])->toBe('Gabung')
            ->and($payload->meta['plan_url'])->toBe("/rapat/{$this->meeting->id}")
            ->and($payload->body)->toContain('Video RuangKerja');

        $meet = Meeting::factory()->by($this->dimas)->create();
        $payload = (new MeetingStartingNotification($meet, $meet->firstDate(), 5))->payload($this->rizky);
        expect($payload->url)->toBe("/rapat/{$meet->id}")->and($payload->meta)->not->toHaveKey('plan_url');
    });
});

describe('moderation', function () {
    beforeEach(function () {
        Http::preventStrayRequests();
    });

    it('lets the organizer mute a microphone through the Room Service API', function () {
        Http::fake(['livekit.internal:7880/twirp/*' => Http::response([], 200)]);
        $this->actingAs($this->dimas)
            ->postJson("/rapat/{$this->meeting->id}/video/peserta/{$this->rizky->id}/bisukan", ['track_sid' => 'TR_abc123'])
            ->assertOk();

        Http::assertSent(function (ClientRequest $request) {
            $claims = decodeLiveKitJwt(str_replace('Bearer ', '', $request->header('Authorization')[0]));

            return $request->url() === 'http://livekit.internal:7880/twirp/livekit.RoomService/MutePublishedTrack'
                && $request['room'] === $this->room
                && $request['identity'] === $this->rizky->id
                && $request['track_sid'] === 'TR_abc123'
                && $request['muted'] === true
                && $claims->video->roomAdmin === true
                && $claims->video->room === $this->room;
        });
    });

    it('lets the organizer remove a participant and audits it', function () {
        Http::fake(['livekit.internal:7880/twirp/*' => Http::response([], 200)]);
        $this->actingAs($this->dimas)
            ->deleteJson("/rapat/{$this->meeting->id}/video/peserta/{$this->rizky->id}")
            ->assertOk();

        Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/twirp/livekit.RoomService/RemoveParticipant')
            && $request['identity'] === $this->rizky->id);
        expect(AuditLog::query()->where('action', 'meeting.video_participant_removed')->count())->toBe(1);
    });

    it('denies moderation to everyone but the organizer', function (string $actor, int $status) {
        Http::fake();
        $user = match ($actor) {
            'participant' => $this->rizky,
            'minute taker' => $this->taker,
            'non-participant' => $this->outsider,
            'other company' => $this->foreign,
        };

        $this->actingAs($user)
            ->postJson("/rapat/{$this->meeting->id}/video/peserta/{$this->dimas->id}/bisukan", ['track_sid' => 'TR_abc'])
            ->assertStatus($status);
        $this->actingAs($user)->deleteJson("/rapat/{$this->meeting->id}/video/peserta/{$this->dimas->id}")->assertStatus($status);

        Http::assertNothingSent();
    })->with([
        'participant' => ['participant', 403],
        'minute taker' => ['minute taker', 403],
        'non-participant' => ['non-participant', 404],
        'other company' => ['other company', 404],
    ]);

    it('validates the track and refuses moderating oneself', function () {
        Http::fake();
        $this->actingAs($this->dimas)
            ->postJson("/rapat/{$this->meeting->id}/video/peserta/{$this->rizky->id}/bisukan", ['track_sid' => 'bad'])
            ->assertUnprocessable()->assertJsonValidationErrors('track_sid');
        $this->actingAs($this->dimas)
            ->deleteJson("/rapat/{$this->meeting->id}/video/peserta/{$this->dimas->id}")
            ->assertUnprocessable();

        Http::assertNothingSent();
    });

    it('reports a LiveKit failure as 502', function () {
        Http::fake(['livekit.internal:7880/twirp/*' => Http::response(['code' => 'not_found'], 404)]);

        $this->actingAs($this->dimas)
            ->deleteJson("/rapat/{$this->meeting->id}/video/peserta/{$this->rizky->id}")
            ->assertStatus(502)->assertJsonPath('message', 'Server rapat tidak menjawab. Coba lagi.');
    });
});

describe('policy and rooms', function () {
    it('maps occurrences to room names and back', function () {
        $rooms = app(VideoRooms::class);

        expect($rooms->roomName(occurrenceOf($this->meeting)))->toBe($this->room)
            ->and($rooms->parseRoom($this->room))->toBe(['meeting_id' => $this->meeting->id, 'date' => '2026-10-05'])
            ->and($rooms->parseRoom('rk-'.$this->meeting->id.'-20261332'))->toBeNull()
            ->and($rooms->parseRoom('room'))->toBeNull()
            ->and($rooms->apiUrl())->toBe('http://livekit.internal:7880');

        config(['livekit.api_url' => null]);
        expect($rooms->apiUrl())->toBe('https://rapat.example.test');
    });

    it('matches the openVideo / joinVideo / moderateVideo matrix', function () {
        $occurrence = occurrenceOf($this->meeting);
        $declined = User::factory()->withRole(Role::Anggota)->create();
        $this->meeting->participants()->create(['user_id' => $declined->id, 'rsvp' => Rsvp::No]);

        foreach ([
            [$this->dimas, 'allow', 'allow', 'allow'],
            [$this->rizky, 'allow', 'allow', 'deny'],
            [$this->taker, 'allow', 'allow', 'deny'],
            [$declined, 'allow', 'allow', 'deny'],
            [$this->outsider, 'hidden', 'hidden', 'hidden'],
            [$this->foreign, 'hidden', 'hidden', 'hidden'],
        ] as [$user, $open, $join, $moderate]) {
            expect(meetingVerdict($user, 'openVideo', $this->meeting))->toBe($open)
                ->and(meetingVerdict($user, 'joinVideo', [$this->meeting, $occurrence]))->toBe($join)
                ->and(meetingVerdict($user, 'moderateVideo', $this->meeting))->toBe($moderate);
        }
    });
});
