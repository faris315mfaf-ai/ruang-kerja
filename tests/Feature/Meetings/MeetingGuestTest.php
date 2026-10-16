<?php

use App\Domain\Meetings\Enums\LobbyStatus;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Guests\Jobs\RemoveGuestsFromRooms;
use App\Domain\Meetings\Guests\Services\GuestLinks;
use App\Domain\Meetings\Queries\VideoAttendance;
use App\Domain\Meetings\Transcripts\Actions\RecordTranscriptUpdate;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\MeetingParticipant;
use App\Models\MeetingTranscript;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
 * External guests of a video meeting (docs/sesi/rapat-tamu-eksternal.md):
 * personal link without a stored token, waiting room, LiveKit token without
 * admin rights, kicking, expiry/rotation/revoking, attendance with the
 * "Tamu" label, no transcript for guests, policy matrix, API v1 twins,
 * throttling and "nothing leaks" checks.
 */
const GUEST_LK_SECRET = 'guest-livekit-secret-at-least-32-characters';

function guestConfigureLiveKit(): void
{
    config([
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'http://livekit.internal:7880',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => GUEST_LK_SECRET,
        'livekit.token_ttl' => 600,
    ]);
}

function guestToken(string $linkUrl): string
{
    return substr($linkUrl, strrpos($linkUrl, '/tamu/') + 6);
}

/**
 * @return array<string, mixed> the organizer's view of the new guest
 */
function guestInvite(string $email = 'budi@mitra.test', ?string $name = null): array
{
    return test()->actingAs(test()->dimas)
        ->postJson('/rapat/'.test()->meeting->id.'/tamu', array_filter(['email' => $email, 'name' => $name]))
        ->assertSuccessful()
        ->json('guest');
}

/**
 * @return object LiveKit claims
 */
function guestDecode(string $jwt): object
{
    JWT::$timestamp = CarbonImmutable::now()->getTimestamp();

    try {
        return JWT::decode($jwt, new Key(GUEST_LK_SECRET, 'HS256'));
    } finally {
        JWT::$timestamp = null;
    }
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config(['features.meetings' => true]);
    guestConfigureLiveKit();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:50', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->rizky = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rizky Aditya']);
    $this->taker = User::factory()->withRole(Role::Anggota)->create(['name' => 'Sari Notulis']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')
        ->withParticipants([$this->rizky, $this->taker])
        ->create(['title' => 'Sinkron mitra', 'description' => 'RAHASIA-DESKRIPSI', 'agenda' => ['RAHASIA-AGENDA'], 'minute_taker_id' => $this->taker->id]);
    $this->base = '/rapat/'.$this->meeting->id;
});

describe('inviting guests and their links', function () {
    it('creates a personal link that is not stored and can be copied again', function () {
        $guest = guestInvite('Budi@Mitra.test', 'Budi Mitra');
        $token = guestToken($guest['link_url']);

        expect($guest['email'])->toBe('budi@mitra.test')
            ->and($guest['name'])->toBe('Budi Mitra')
            ->and($guest['status'])->toBe('none')
            ->and($guest['identity'])->toBe('guest:'.$guest['id'])
            ->and($token)->toMatch('/^'.GuestLinks::PATTERN.'$/')
            ->and(str_starts_with($token, $guest['id']))->toBeTrue();

        // Only a nonce and the sha256 of the token are stored; no column holds the token itself.
        $row = (array) DB::table('meeting_participants')->where('id', $guest['id'])->first();
        expect($row['link_token_hash'])->toBe(hash('sha256', $token))
            ->and(json_encode($row))->not->toContain($token);

        // The organizer can copy it again (deterministic HMAC) — same link, also after a re-listing.
        $again = $this->getJson($this->base.'/tamu')->assertOk()->assertHeader('Cache-Control')->json('guests.0');
        expect($again['link_url'])->toBe($guest['link_url']);
        expect(GuestLinks::hash($token))->toBe($row['link_token_hash']);

        $audit = AuditLog::query()->where('action', 'meeting.guest_added')->sole();
        expect(json_encode($audit->new_values))->not->toContain($token)
            ->and($audit->user_id)->toBe($this->dimas->id);
    });

    it('re-adding an e-mail keeps the link and updates the name', function () {
        $first = guestInvite('budi@mitra.test', 'Budi');
        $second = $this->postJson($this->base.'/tamu', ['email' => 'BUDI@mitra.test', 'name' => 'Budi Santoso'])->assertOk()->json('guest');

        expect($second['link_url'])->toBe($first['link_url'])
            ->and($second['name'])->toBe('Budi Santoso')
            ->and(MeetingParticipant::query()->whereNotNull('email')->count())->toBe(1)
            ->and(AuditLog::query()->where('action', 'meeting.guest_added')->count())->toBe(1);
    });

    it('creates links for guests added through the meeting form and keeps them when the meeting is edited', function () {
        $payload = meetingPayload([
            'title' => 'Rapat dengan mitra', 'date' => '2026-10-06', 'platform' => 'video', 'join_url' => null,
            'participant_ids' => [$this->rizky->id], 'guest_emails' => ['sinta@mitra.test'], 'guest_names' => ['sinta@mitra.test' => '  <b>Sinta</b> '],
        ]);

        $this->actingAs($this->dimas)->post('/rapat', $payload)->assertRedirect();
        $meeting = Meeting::query()->where('title', 'Rapat dengan mitra')->sole();
        $guest = MeetingParticipant::query()->where('meeting_id', $meeting->id)->whereNotNull('email')->sole();

        expect($guest->guest_name)->toBe('Sinta')
            ->and($guest->link_token_hash)->not->toBeNull()
            ->and($guest->link_expires_at)->not->toBeNull();
        $hash = $guest->link_token_hash;

        // Edited with another guest: Sinta keeps her link, the new one gets its own, a removed one dies.
        $this->patch('/rapat/'.$meeting->id, [...$payload, 'guest_emails' => ['sinta@mitra.test', 'omar@mitra.test']])->assertRedirect();
        expect($guest->fresh()->link_token_hash)->toBe($hash)
            ->and(MeetingParticipant::query()->where('meeting_id', $meeting->id)->whereNotNull('email')->count())->toBe(2);

        $this->patch('/rapat/'.$meeting->id, [...$payload, 'guest_emails' => ['omar@mitra.test']])->assertRedirect();
        expect(MeetingParticipant::query()->where('meeting_id', $meeting->id)->whereNotNull('email')->pluck('email')->all())->toBe(['omar@mitra.test']);
    });

    it('follows a rescheduled meeting with the link expiry', function () {
        $guest = guestInvite();
        $row = MeetingParticipant::query()->findOrFail($guest['id']);
        expect($row->link_expires_at->toIso8601String())->toBe(CarbonImmutable::parse('2026-10-05 13:00', 'Asia/Jakarta')->utc()->toIso8601String());

        $payload = meetingPayload([
            'title' => 'Sinkron mitra', 'date' => '2026-10-06', 'start' => '14:00', 'platform' => 'video', 'join_url' => null,
            'participant_ids' => [$this->rizky->id, $this->taker->id], 'minute_taker_id' => $this->taker->id, 'guest_emails' => ['budi@mitra.test'],
        ]);
        $this->actingAs($this->dimas)->patch($this->base, $payload)->assertRedirect();

        expect($row->fresh()->link_expires_at->toIso8601String())->toBe(CarbonImmutable::parse('2026-10-06 17:00', 'Asia/Jakarta')->utc()->toIso8601String());
    });

    it('lets only the organizer of a video meeting manage guests', function (string $actor, int $status) {
        guestInvite();
        $user = match ($actor) {
            'organizer' => $this->dimas, 'minute taker' => $this->taker, 'participant' => $this->rizky, 'outsider' => $this->outsider,
        };

        $this->actingAs($user)->getJson($this->base.'/tamu')->assertStatus($status);
        $this->actingAs($user)->postJson($this->base.'/tamu', ['email' => 'lain@mitra.test'])->assertStatus($status === 200 ? 201 : $status);
    })->with([
        'organizer' => ['organizer', 200],
        'minute taker' => ['minute taker', 403],
        'participant' => ['participant', 403],
        'outsider' => ['outsider', 404],
    ]);

    it('has no guest list for other platforms', function () {
        $meet = Meeting::factory()->by($this->dimas)->at('2026-10-05 10:00')->create();

        $this->actingAs($this->dimas)->getJson('/rapat/'.$meet->id.'/tamu')->assertNotFound();
    });

    it('validates e-mail and name and caps the number of guests', function () {
        $this->actingAs($this->dimas);
        $this->postJson($this->base.'/tamu', ['email' => 'bukan-email'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson($this->base.'/tamu', ['email' => 'a@mitra.test', 'name' => str_repeat('x', 61)])->assertUnprocessable()->assertJsonValidationErrors('name');

        foreach (range(1, 30) as $i) {
            MeetingParticipant::query()->create(['meeting_id' => $this->meeting->id, 'email' => "tamu{$i}@mitra.test"]);
        }

        $this->postJson($this->base.'/tamu', ['email' => 'ke31@mitra.test'])->assertUnprocessable()->assertJsonPath('code', 'terlalu_banyak_tamu');
        $this->postJson($this->base.'/tamu', ['email' => 'tamu3@mitra.test'])->assertOk();
    });
});

describe('the guest page and the waiting room', function () {
    it('walks a guest from the link to a LiveKit token', function () {
        $guest = guestInvite('budi@mitra.test', 'Budi');
        $token = guestToken($guest['link_url']);
        $api = "/api/tamu/{$token}";

        auth()->logout();
        $this->app['auth']->forgetGuards();

        $info = $this->getJson("{$api}/info")->assertOk()->assertHeader('Cache-Control')
            ->assertJsonPath('status', 'none')
            ->assertJsonPath('window.state', 'open')
            ->assertJsonPath('meeting.title', 'Sinkron mitra')
            ->assertJsonPath('meeting.organizer_name', 'Dimas Pratama')
            ->assertJsonPath('guest.name', 'Budi')
            ->json();
        expect(str_contains((string) json_encode($info), 'RAHASIA'))->toBeFalse()
            ->and(array_keys($info['meeting']))->toBe(['title', 'starts_at', 'ends_at', 'occurrence_date', 'organizer_name'])
            ->and(str_contains((string) json_encode($info), $this->rizky->name))->toBeFalse();

        $this->postJson("{$api}/token")->assertForbidden()->assertJsonPath('code', 'belum_meminta');

        $this->postJson("{$api}/minta-masuk", ['name' => '  <i>Budi</i>   Mitra (Tamu) '])->assertOk()->assertJsonPath('status', 'waiting');
        expect(MeetingParticipant::query()->findOrFail($guest['id']))->guest_name->toBe('Budi Mitra')
            ->and(MeetingParticipant::query()->findOrFail($guest['id'])->lobby_occurrence_date->toDateString())->toBe('2026-10-05');
        $this->getJson("{$api}/status")->assertOk()->assertJsonPath('status', 'waiting');
        $this->postJson("{$api}/token")->assertForbidden()->assertJsonPath('code', 'menunggu');

        // An invited colleague (not the organizer) sees and admits the guest.
        $waiting = $this->actingAs($this->rizky)->getJson($this->base.'/video/ruang-tunggu')->assertOk()
            ->assertJsonPath('waiting_count', 1)->json('waiting.0');
        expect($waiting)->toMatchArray(['id' => $guest['id'], 'name' => 'Budi Mitra', 'email' => 'budi@mitra.test', 'identity' => 'guest:'.$guest['id']]);

        $this->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')->assertOk()->assertJsonPath('guest.status', 'admitted');
        $this->app['auth']->forgetGuards();

        $this->getJson("{$api}/status")->assertOk()->assertJsonPath('status', 'admitted');
        $response = $this->postJson("{$api}/token")->assertOk()->assertHeader('Cache-Control')
            ->assertJsonPath('identity', 'guest:'.$guest['id'])
            ->assertJsonPath('name', 'Budi Mitra (Tamu)')
            ->assertJsonPath('role', 'guest')
            ->assertJsonPath('can', ['moderate' => false, 'call_participants' => false, 'edit_minutes' => false])
            ->assertJsonPath('room', 'rk-'.strtolower($this->meeting->id).'-20261005');

        $claims = guestDecode($response->json('token'));
        expect($claims->sub)->toBe('guest:'.$guest['id'])
            ->and($claims->name)->toBe('Budi Mitra (Tamu)')
            ->and($claims->video->roomJoin)->toBeTrue()
            ->and($claims->video->canPublish)->toBeTrue()
            ->and($claims->video->canSubscribe)->toBeTrue()
            ->and($claims->video->canPublishData)->toBeTrue()
            ->and(isset($claims->video->roomAdmin))->toBeFalse()
            ->and(isset($claims->video->canUpdateOwnMetadata))->toBeFalse()
            ->and(isset($claims->video->roomRecord))->toBeFalse()
            ->and(isset($claims->video->hidden))->toBeFalse()
            ->and(json_decode($claims->metadata, true))->toBe(['guest' => true, 'avatar_url' => null, 'organizer' => false])
            ->and($claims->exp - $claims->nbf)->toBeLessThanOrEqual(620);

        // Audited without the token; "joined" once per admission.
        $this->postJson("{$api}/token")->assertOk();
        expect(AuditLog::query()->whereIn('action', ['meeting.guest_admitted', 'meeting.guest_joined'])->pluck('action')->sort()->values()->all())
            ->toBe(['meeting.guest_admitted', 'meeting.guest_joined']);
        expect(AuditLog::query()->where('action', 'like', 'meeting.guest_%')->get()->contains(fn (AuditLog $log): bool => str_contains((string) json_encode($log->new_values), $token)))->toBeFalse();
    });

    it('lets the guest page render for a valid link and hides unknown links', function () {
        $guest = guestInvite('budi@mitra.test', 'Budi');
        $token = guestToken($guest['link_url']);
        auth()->logout();

        $this->get("/tamu/{$token}")->assertOk()
            ->assertHeader('Referrer-Policy', 'no-referrer')
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow')
            ->assertInertia(fn (Assert $page) => $page->component('meetings/guest')
                ->where('token', $token)
                ->where('guest.status', 'none')
                ->where('guest.meeting.title', 'Sinkron mitra'));

        $permissions = $this->get("/tamu/{$token}")->headers->get('Permissions-Policy');
        expect($permissions)->toContain('microphone=(self)');

        $unknown = substr($token, 0, 26).str_repeat('a', 32);
        $this->get("/tamu/{$unknown}")->assertNotFound()
            ->assertInertia(fn (Assert $page) => $page->component('meetings/guest')->where('token', null)->where('guest.status', 'unknown'));
        $this->get('/tamu/bukan-token')->assertNotFound();
    });

    it('answers the same generic 404 for unknown, rotated and revoked links', function () {
        $guest = guestInvite();
        $token = guestToken($guest['link_url']);
        $unknown = substr($token, 0, 26).str_repeat('b', 32);
        $otherMeeting = substr(strtolower((string) str()->ulid()), 0, 26).str_repeat('c', 32);

        $bodies = [];

        foreach ([$unknown, $otherMeeting] as $bad) {
            foreach (['info' => 'get', 'status' => 'get', 'token' => 'post', 'minta-masuk' => 'post'] as $endpoint => $verb) {
                $response = $this->{$verb.'Json'}("/api/tamu/{$bad}/{$endpoint}", $verb === 'post' ? ['name' => 'Budi'] : [])->assertNotFound();
                $bodies[] = $response->json();
            }
        }

        expect(array_unique(array_map('json_encode', $bodies)))->toHaveCount(1);
        $this->getJson('/api/tamu/pendek/info')->assertNotFound();

        $this->actingAs($this->dimas)->postJson($this->base.'/tamu/'.$guest['id'].'/putar')->assertOk();
        auth()->logout();
        $this->getJson("/api/tamu/{$token}/info")->assertNotFound()->assertJson($bodies[0]);
    });

    it('turns a guest away outside the join window', function () {
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);

        $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
        $this->getJson("{$api}/info")->assertOk()->assertJsonPath('window.state', 'early')->assertJsonPath('meeting.title', 'Sinkron mitra');
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertStatus(409)
            ->assertJsonPath('code', 'ruang_belum_dibuka')->assertJsonPath('message', 'Ruang rapat dibuka pukul 09.45.');

        $this->travelTo(CarbonImmutable::parse('2026-10-05 13:30', 'Asia/Jakarta'));
        $this->getJson("{$api}/info")->assertOk()->assertJsonPath('status', 'closed')->assertJsonPath('meeting', null)->assertJsonPath('window', null);
        $this->getJson("{$api}/status")->assertOk()->assertJsonPath('status', 'closed');
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertStatus(410)->assertJsonPath('code', 'ditutup');
        $this->postJson("{$api}/token")->assertStatus(410)->assertJsonPath('code', 'ditutup');
    });

    it('closes the link when the meeting is canceled or not video any more', function () {
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk();

        $this->meeting->update(['canceled_at' => now()]);
        $this->getJson("{$api}/status")->assertJsonPath('status', 'closed');
        $this->meeting->update(['canceled_at' => null, 'platform' => 'meet']);
        $this->getJson("{$api}/status")->assertJsonPath('status', 'closed');
        $this->meeting->update(['platform' => 'video']);
        $this->getJson("{$api}/status")->assertJsonPath('status', 'waiting');
        $this->meeting->delete();
        $this->getJson("{$api}/info")->assertNotFound();
    });

    it('expires a link that outlives its date', function () {
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);
        MeetingParticipant::query()->whereKey($guest['id'])->update(['link_expires_at' => now()->subMinute()]);

        $this->getJson("{$api}/info")->assertOk()->assertJsonPath('status', 'expired')->assertJsonPath('meeting', null);
        $this->getJson("{$api}/status")->assertJsonPath('status', 'expired');
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertStatus(410)->assertJsonPath('code', 'kedaluwarsa');
        $this->postJson("{$api}/token")->assertStatus(410)->assertJsonPath('code', 'kedaluwarsa');
    });

    it('validates the typed name', function () {
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);

        $this->postJson("{$api}/minta-masuk", [])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson("{$api}/minta-masuk", ['name' => 'A'])->assertUnprocessable();
        $this->postJson("{$api}/minta-masuk", ['name' => str_repeat('n', 61)])->assertUnprocessable();
        $this->postJson("{$api}/minta-masuk", ['name' => '<b></b> (Tamu)'])->assertUnprocessable()->assertJsonPath('code', 'nama_kosong');
        expect(MeetingParticipant::query()->findOrFail($guest['id'])->lobby_status)->toBe(LobbyStatus::None);
    });

    it('lets the waiting guest fix a typo in the name', function () {
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);

        $this->postJson("{$api}/minta-masuk", ['name' => 'Bdui'])->assertOk();
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk()->assertJsonPath('status', 'waiting');

        $row = MeetingParticipant::query()->findOrFail($guest['id']);
        expect($row->guest_name)->toBe('Budi')->and($row->lobby_requests)->toBe(1);
    });

    it('denies, and a denied guest cannot ask again until admitted', function () {
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk();

        $this->actingAs($this->taker)->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/tolak')->assertOk()->assertJsonPath('guest.status', 'denied');
        auth()->logout();

        $this->getJson("{$api}/status")->assertJsonPath('status', 'denied');
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk()->assertJsonPath('status', 'denied');
        $this->postJson("{$api}/token")->assertForbidden()->assertJsonPath('code', 'ditolak');

        // Denying twice is harmless; denying someone who never asked is refused.
        $this->actingAs($this->dimas)->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/tolak')->assertOk();
        $this->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')->assertOk()->assertJsonPath('guest.status', 'admitted');
        auth()->logout();
        $this->postJson("{$api}/token")->assertOk();
        expect(AuditLog::query()->where('action', 'meeting.guest_denied')->count())->toBe(1);
    });

    it('refuses to admit a guest who never asked', function () {
        $guest = guestInvite();

        $this->actingAs($this->dimas)->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')
            ->assertStatus(409)->assertJsonPath('code', 'belum_meminta');
    });

    it('keeps a kicked guest out until admitted again', function () {
        Http::fake(['livekit.internal:7880/*' => Http::response([])]);
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk();
        $this->actingAs($this->dimas)->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')->assertOk();
        auth()->logout();
        $this->postJson("{$api}/token")->assertOk();

        $this->actingAs($this->dimas)->deleteJson($this->base.'/video/peserta/guest:'.$guest['id'])->assertOk();
        Http::assertSent(fn (ClientRequest $request): bool => str_ends_with($request->url(), '/twirp/livekit.RoomService/RemoveParticipant')
            && $request['identity'] === 'guest:'.$guest['id'] && $request['room'] === 'rk-'.strtolower($this->meeting->id).'-20261005');
        auth()->logout();

        $this->getJson("{$api}/status")->assertJsonPath('status', 'removed');
        $this->postJson("{$api}/token")->assertForbidden()->assertJsonPath('code', 'dikeluarkan');
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk()->assertJsonPath('status', 'removed');
        expect(AuditLog::query()->where('action', 'meeting.guest_kicked')->count())->toBe(1);

        $this->actingAs($this->dimas)->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')->assertOk();
        auth()->logout();
        $this->postJson("{$api}/token")->assertOk();
    });

    it('keeps only the organizer and no other role in control of removing and muting', function () {
        Http::fake(['livekit.internal:7880/*' => Http::response([])]);
        $guest = guestInvite();

        $this->actingAs($this->rizky)->deleteJson($this->base.'/video/peserta/guest:'.$guest['id'])->assertForbidden();
        $this->actingAs($this->rizky)->postJson($this->base.'/video/peserta/guest:'.$guest['id'].'/bisukan', ['track_sid' => 'TR_abc'])->assertForbidden();
        $this->actingAs($this->dimas)->postJson($this->base.'/video/peserta/guest:'.$guest['id'].'/bisukan', ['track_sid' => 'TR_abc'])->assertOk();
        $this->actingAs($this->dimas)->deleteJson($this->base.'/video/peserta/guest:'.strtolower((string) str()->ulid()))->assertUnprocessable();
    });

    it('needs a fresh admission for every occurrence of a series', function () {
        $series = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')->recurring(Recurrence::Weekly)
            ->withParticipants([$this->rizky])->create(['title' => 'Mingguan mitra']);
        $guest = $this->actingAs($this->dimas)->postJson('/rapat/'.$series->id.'/tamu', ['email' => 'budi@mitra.test'])->json('guest');
        $api = '/api/tamu/'.guestToken($guest['link_url']);
        auth()->logout();

        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk();
        $this->actingAs($this->dimas)->postJson('/rapat/'.$series->id.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')->assertOk();
        auth()->logout();
        $this->postJson("{$api}/token")->assertOk()->assertJsonPath('occurrence_date', '2026-10-05');

        // Same day, later: the window is over — the link points at next Monday.
        $this->travelTo(CarbonImmutable::parse('2026-10-05 13:30', 'Asia/Jakarta'));
        $this->getJson("{$api}/info")->assertOk()->assertJsonPath('status', 'none')->assertJsonPath('meeting.occurrence_date', '2026-10-12')->assertJsonPath('window.state', 'early');

        $this->travelTo(CarbonImmutable::parse('2026-10-12 09:50', 'Asia/Jakarta'));
        $this->getJson("{$api}/status")->assertJsonPath('status', 'none');
        $this->postJson("{$api}/token")->assertForbidden()->assertJsonPath('code', 'belum_meminta');
        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk()->assertJsonPath('status', 'waiting');
        expect(MeetingParticipant::query()->findOrFail($guest['id'])->lobby_occurrence_date->toDateString())->toBe('2026-10-12');
    });

    it('refuses the token when LiveKit is not configured', function () {
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);
        config(['livekit.url' => null]);

        $this->postJson("{$api}/token")->assertStatus(503)->assertJsonPath('code', 'video_belum_siap');
    });

    it('throttles per link and per IP', function () {
        $guest = guestInvite();
        $api = '/api/tamu/'.guestToken($guest['link_url']);

        foreach (range(1, 30) as $i) {
            $this->getJson("{$api}/info")->assertOk();
        }

        $this->getJson("{$api}/info")->assertStatus(429)->assertJsonPath('code', 'throttled');
        // Another link is not affected by this link's budget.
        $other = guestInvite('lain@mitra.test');
        $this->getJson('/api/tamu/'.guestToken($other['link_url']).'/info')->assertOk();

        foreach (range(1, 6) as $i) {
            $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertOk();
        }

        $this->postJson("{$api}/minta-masuk", ['name' => 'Budi'])->assertStatus(429);
    });
});

describe('rotating and revoking', function () {
    it('rotating kills the old link, clears the waiting room and removes a guest in the room', function () {
        Bus::fake([RemoveGuestsFromRooms::class]);
        $guest = guestInvite();
        $old = guestToken($guest['link_url']);
        $this->postJson("/api/tamu/{$old}/minta-masuk", ['name' => 'Budi'])->assertOk();
        $this->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')->assertOk();
        MeetingAttendance::query()->create([
            'meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-10-05', 'participant_id' => $guest['id'], 'guest_name' => 'Budi (Tamu)',
            'room' => 'rk-'.strtolower($this->meeting->id).'-20261005', 'participant_sid' => 'PA_budi', 'joined_at' => now(),
        ]);

        $new = $this->postJson($this->base.'/tamu/'.$guest['id'].'/putar')->assertOk()->json('guest');

        expect($new['link_url'])->not->toBe($guest['link_url'])
            ->and($new['status'])->toBe('none')
            ->and($new['link_rotated_at'])->not->toBeNull();
        Bus::assertDispatched(RemoveGuestsFromRooms::class, fn (RemoveGuestsFromRooms $job): bool => $job->targets[0]['identity'] === 'guest:'.$guest['id']);
        auth()->logout();
        $this->getJson("/api/tamu/{$old}/status")->assertNotFound();
        $this->getJson('/api/tamu/'.guestToken($new['link_url']).'/status')->assertOk()->assertJsonPath('status', 'none');
        expect(AuditLog::query()->where('action', 'meeting.guest_link_rotated')->count())->toBe(1);
    });

    it('revoking deletes the guest and the link', function () {
        $guest = guestInvite();
        $token = guestToken($guest['link_url']);

        $this->actingAs($this->rizky)->deleteJson($this->base.'/tamu/'.$guest['id'])->assertForbidden();
        $this->actingAs($this->dimas)->deleteJson($this->base.'/tamu/'.$guest['id'])->assertOk();

        expect(MeetingParticipant::query()->whereKey($guest['id'])->exists())->toBeFalse()
            ->and(AuditLog::query()->where('action', 'meeting.guest_removed')->count())->toBe(1);
        auth()->logout();
        $this->getJson("/api/tamu/{$token}/info")->assertNotFound();
    });

    it('does not mix up guests of different meetings', function () {
        $guest = guestInvite();
        $other = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 11:00')->withParticipants([$this->rizky])->create();

        $this->actingAs($this->dimas)->deleteJson('/rapat/'.$other->id.'/tamu/'.$guest['id'])->assertNotFound();
        $this->postJson('/rapat/'.$other->id.'/tamu/'.$guest['id'].'/putar')->assertNotFound();
        $this->postJson('/rapat/'.$other->id.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')->assertNotFound();
        expect(MeetingParticipant::query()->whereKey($guest['id'])->exists())->toBeTrue();
    });
});

describe('policy matrix', function () {
    it('separates guest management (organizer) from the waiting room (everyone invited)', function () {
        $direksi = User::factory()->withRole(Role::Direksi)->create();
        $this->meeting->update(['leadership' => true]);
        $meeting = $this->meeting->fresh();

        $matrix = fn (string $ability): array => [
            'organizer' => meetingVerdict($this->dimas, $ability, $meeting),
            'minute taker' => meetingVerdict($this->taker, $ability, $meeting),
            'participant' => meetingVerdict($this->rizky, $ability, $meeting),
            'observer' => meetingVerdict($direksi, $ability, $meeting),
            'outsider' => meetingVerdict($this->outsider, $ability, $meeting),
        ];

        expect($matrix('manageGuests'))->toBe(['organizer' => 'allow', 'minute taker' => 'deny', 'participant' => 'deny', 'observer' => 'deny', 'outsider' => 'hidden'])
            ->and($matrix('manageLobby'))->toBe(['organizer' => 'allow', 'minute taker' => 'allow', 'participant' => 'allow', 'observer' => 'deny', 'outsider' => 'hidden']);

        $this->meeting->update(['canceled_at' => now()]);
        expect(meetingVerdict($this->dimas, 'manageLobby', $this->meeting->fresh()))->toBe('deny')
            ->and(meetingVerdict($this->dimas, 'manageGuests', $this->meeting->fresh()))->toBe('deny');
    });

    it('keeps guests away from every employee route', function () {
        $guest = guestInvite();
        $token = guestToken($guest['link_url']);
        auth()->logout();

        foreach (['', '/notulen', '/tamu', '/video/ruang-tunggu', '/video/kehadiran', '/notulen-otomatis/transkrip'] as $suffix) {
            $this->getJson($this->base.$suffix)->assertUnauthorized();
        }

        $this->getJson($this->base.'/ruang')->assertUnauthorized();
        $this->postJson($this->base.'/video/token')->assertUnauthorized();
        $this->postJson($this->base.'/video/ruang-tunggu/'.$guest['id'].'/izinkan')->assertUnauthorized();
        // The link itself grants nothing on the employee side either.
        $this->getJson($this->base.'?token='.$token)->assertUnauthorized();
        $this->getJson("/api/v1/rapat/{$this->meeting->id}/tamu")->assertUnauthorized();
    });
});

describe('attendance, transcripts and privacy', function () {
    /**
     * @return array<string, mixed>
     */
    function guestWebhookEvent(string $type, string $room, string $identity, string $sid, ?string $id = null): array
    {
        $at = CarbonImmutable::now()->getTimestamp();

        return [
            'event' => $type, 'id' => $id ?? 'EV_'.bin2hex(random_bytes(6)), 'createdAt' => (string) $at,
            'room' => ['sid' => 'RM_x', 'name' => $room],
            'participant' => ['sid' => $sid, 'identity' => $identity, 'name' => 'Direktur Utama', 'joinedAt' => (string) $at],
        ];
    }

    function guestPostWebhook(array $event)
    {
        $body = json_encode($event, JSON_THROW_ON_ERROR);
        $now = CarbonImmutable::now()->getTimestamp();
        $jwt = JWT::encode(['iss' => 'devkey', 'nbf' => $now, 'exp' => $now + 300, 'sha256' => base64_encode(hash('sha256', $body, true))], GUEST_LK_SECRET, 'HS256');

        return test()->call('POST', '/api/livekit/webhook', [], [], [], ['HTTP_AUTHORIZATION' => $jwt, 'CONTENT_TYPE' => 'application/webhook+json'], $body);
    }

    it('records the guest in the room with the Tamu label and never as a user', function () {
        $guest = guestInvite('budi@mitra.test', 'Budi');
        $room = 'rk-'.strtolower($this->meeting->id).'-20261005';
        $identity = 'guest:'.$guest['id'];

        guestPostWebhook(guestWebhookEvent('participant_joined', $room, $identity, 'PA_guest'))->assertOk()->assertJson(['status' => 'recorded']);
        guestPostWebhook(guestWebhookEvent('participant_joined', $room, $this->rizky->id, 'PA_rizky'))->assertOk();

        $row = MeetingAttendance::query()->where('participant_sid', 'PA_guest')->sole();
        expect($row->user_id)->toBeNull()
            ->and($row->participant_id)->toBe($guest['id'])
            ->and($row->guest_name)->toBe('Budi (Tamu)');

        $attendance = $this->actingAs($this->rizky)->getJson($this->base.'/video/kehadiran')->assertOk()->json();
        expect($attendance['in_room'])->toBe(1)
            ->and($attendance['guests'])->toHaveCount(1)
            ->and($attendance['guests'][0])->toMatchArray(['participant_id' => $guest['id'], 'name' => 'Budi (Tamu)', 'in_room' => true, 'sessions' => 1])
            ->and(array_column($attendance['attendance'], 'user_id'))->toBe([$this->rizky->id]);
        expect($this->actingAs($this->dimas)->getJson($this->base.'/tamu')->json('guests.0.in_room'))->toBeTrue();

        guestPostWebhook(guestWebhookEvent('participant_left', $room, $identity, 'PA_guest'))->assertOk();
        expect($row->fresh()->left_at)->not->toBeNull()
            ->and($this->getJson($this->base.'/video/kehadiran')->json('guests.0.in_room'))->toBeFalse();
    });

    it('ignores guest identities that belong to another meeting or do not exist', function () {
        $guest = guestInvite();
        $other = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')->create();
        $otherRoom = 'rk-'.strtolower($other->id).'-20261005';

        guestPostWebhook(guestWebhookEvent('participant_joined', $otherRoom, 'guest:'.$guest['id'], 'PA_x'))->assertOk()->assertJson(['status' => 'ignored']);
        guestPostWebhook(guestWebhookEvent('participant_joined', 'rk-'.strtolower($this->meeting->id).'-20261005', 'guest:'.strtolower((string) str()->ulid()), 'PA_y'))->assertOk()->assertJson(['status' => 'ignored']);
        expect(MeetingAttendance::query()->count())->toBe(0);
    });

    it('closes the session of a guest that was revoked while in the room', function () {
        $guest = guestInvite();
        $room = 'rk-'.strtolower($this->meeting->id).'-20261005';
        guestPostWebhook(guestWebhookEvent('participant_joined', $room, 'guest:'.$guest['id'], 'PA_gone'))->assertOk();

        $this->actingAs($this->dimas)->deleteJson($this->base.'/tamu/'.$guest['id'])->assertOk();
        guestPostWebhook(guestWebhookEvent('participant_left', $room, 'guest:'.$guest['id'], 'PA_gone'))->assertOk()->assertJson(['status' => 'recorded']);

        expect(MeetingAttendance::query()->where('participant_sid', 'PA_gone')->sole()->left_at)->not->toBeNull();
    });

    it('never transcribes guests: their segments are dropped and not offered as speakers', function () {
        config([
            'notulen.transcriber.url' => 'http://worker.test:8090',
            'notulen.transcriber.secret' => 'guest-notulen-secret-0123456789-abcdef',
            'notulen.transcriber.callback_secret' => 'guest-notulen-callback-9876543210-fedcba',
            'notulen.llm.api_key' => '',
        ]);
        $this->meeting->update(['auto_minutes' => true]);
        $guest = guestInvite();

        app(RecordTranscriptUpdate::class)->handle([
            'room' => 'rk-'.strtolower($this->meeting->id).'-20261005', 'session' => 's1', 'status' => 'ready',
            'started_at' => '2026-10-05T03:00:00.000Z', 'ended_at' => '2026-10-05T04:00:00.000Z', 'language' => 'id', 'model' => 'm',
            'segments' => [
                ['speaker_identity' => $this->rizky->id, 'speaker_name' => 'x', 'start_ms' => 1000, 'end_ms' => 2000, 'text' => 'Halo dari karyawan.'],
                ['speaker_identity' => 'guest:'.$guest['id'], 'speaker_name' => 'Budi', 'start_ms' => 3000, 'end_ms' => 4000, 'text' => 'Ucapan tamu yang tidak boleh disimpan.'],
                ['speaker_identity' => 'guest:'.strtolower((string) str()->ulid()), 'speaker_name' => 'Lain', 'start_ms' => 5000, 'end_ms' => 6000, 'text' => 'Tamu lain.'],
            ],
        ]);

        $transcript = MeetingTranscript::query()->sole();
        expect(array_column($transcript->segments, 'text'))->toBe(['Halo dari karyawan.'])
            ->and(str_contains((string) json_encode($transcript->segments), 'tamu yang tidak'))->toBeFalse();
    });

    it('does not count guests among the people the minutes are attributed to', function () {
        $guest = guestInvite();
        $room = 'rk-'.strtolower($this->meeting->id).'-20261005';
        guestPostWebhook(guestWebhookEvent('participant_joined', $room, 'guest:'.$guest['id'], 'PA_guest'))->assertOk();
        guestPostWebhook(guestWebhookEvent('participant_joined', $room, $this->rizky->id, 'PA_rizky'))->assertOk();

        $occurrence = occurrenceOf($this->meeting);

        expect(app(VideoAttendance::class)->attendedUserIds($occurrence))->toBe([$this->rizky->id]);
    });
});

describe('API v1 twins', function () {
    it('serves the organizer guest list and the waiting room to the mobile app', function () {
        Sanctum::actingAs($this->dimas);
        $base = '/api/v1/rapat/'.$this->meeting->id;

        $guest = $this->postJson("{$base}/tamu", ['email' => 'budi@mitra.test', 'name' => 'Budi'])->assertCreated()->json('guest');
        $this->getJson("{$base}/tamu")->assertOk()->assertJsonPath('guests.0.link_url', $guest['link_url'])->assertJsonPath('limit', 30);

        $this->postJson('/api/tamu/'.guestToken($guest['link_url']).'/minta-masuk', ['name' => 'Budi'])->assertOk();

        Sanctum::actingAs($this->rizky);
        $this->getJson("{$base}/tamu")->assertForbidden();
        $this->getJson("{$base}/video/ruang-tunggu")->assertOk()->assertJsonPath('waiting_count', 1);
        $this->postJson("{$base}/video/ruang-tunggu/{$guest['id']}/izinkan")->assertOk()->assertJsonPath('guest.status', 'admitted');

        Http::fake(['livekit.internal:7880/*' => Http::response([])]);
        Sanctum::actingAs($this->dimas);
        $this->postJson("{$base}/video/keluarkan", ['user_id' => 'guest:'.$guest['id']])->assertOk();
        expect(MeetingParticipant::query()->findOrFail($guest['id'])->lobby_status)->toBe(LobbyStatus::Removed);

        $this->postJson("{$base}/video/izinkan-masuk", ['user_id' => 'guest:'.$guest['id']])->assertOk()->assertJsonPath('readmitted', true);
        expect(MeetingParticipant::query()->findOrFail($guest['id'])->lobby_status)->toBe(LobbyStatus::Admitted);

        $this->postJson("{$base}/tamu/{$guest['id']}/putar")->assertOk();
        $this->deleteJson("{$base}/tamu/{$guest['id']}")->assertOk();
        Sanctum::actingAs($this->outsider);
        $this->getJson("{$base}/tamu")->assertNotFound();
    });
});
