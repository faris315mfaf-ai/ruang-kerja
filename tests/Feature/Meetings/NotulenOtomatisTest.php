<?php

use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Transcripts\Enums\DraftStatus;
use App\Domain\Meetings\Transcripts\Enums\TranscriptStatus;
use App\Domain\Meetings\Transcripts\Jobs\PurgeExpiredMeetingTranscripts;
use App\Domain\Meetings\Transcripts\Jobs\SummarizeMeetingTranscript;
use App\Domain\Meetings\Transcripts\Services\NotulenSignature;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingTranscript;
use App\Models\MeetingTranscriptConsent;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/meeting-helpers.php';

/*
 * Notulen otomatis (docs/fitur/notulen-otomatis-kontrak.md): worker
 * ingestion (HMAC), LiveKit webhook → worker join/finish, consent, policy,
 * AI summary (Http::fake, never the real API), "Masukkan ke notulen",
 * suggestions → tasks, retention, query budget.
 */
const NOTULEN_SECRET = 'notulen-test-secret-0123456789-abcdef';
const NOTULEN_LK_SECRET = 'livekit-test-secret-at-least-32-characters';

function notulenConfigure(bool $llm = true): void
{
    config([
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_url' => 'http://livekit.internal:7880',
        'livekit.api_key' => 'devkey',
        'livekit.api_secret' => NOTULEN_LK_SECRET,
        'notulen.transcriber.url' => 'http://worker.test:8090',
        'notulen.transcriber.secret' => NOTULEN_SECRET,
        'notulen.llm.base_url' => 'https://llm.test',
        'notulen.llm.api_key' => $llm ? 'test-key' : '',
        'notulen.llm.model' => 'deepseek-chat',
        'notulen.llm.retries' => 0,
    ]);
}

/**
 * @param  array<string, mixed>  $payload
 */
function notulenIngest(array $payload, ?string $secret = null, ?int $timestamp = null, ?string $body = null)
{
    $body ??= json_encode($payload, JSON_THROW_ON_ERROR);
    $timestamp ??= CarbonImmutable::now()->getTimestamp();
    $signature = hash_hmac('sha256', $timestamp.'.'.$body, $secret ?? NOTULEN_SECRET);

    return test()->call('POST', '/api/notulen/transcript', [], [], [], [
        'HTTP_X_NOTULEN_TIMESTAMP' => (string) $timestamp,
        'HTTP_X_NOTULEN_SIGNATURE' => 'v1='.$signature,
        'CONTENT_TYPE' => 'application/json',
    ], $body);
}

/**
 * @param  array<string, mixed>  $event
 */
function notulenLiveKitWebhook(array $event)
{
    $body = json_encode($event, JSON_THROW_ON_ERROR);
    $now = CarbonImmutable::now()->getTimestamp();
    $token = JWT::encode(['iss' => 'devkey', 'nbf' => $now, 'exp' => $now + 300, 'sha256' => base64_encode(hash('sha256', $body, true))], NOTULEN_LK_SECRET, 'HS256');

    return test()->call('POST', '/api/notulen/livekit', [], [], [], ['HTTP_AUTHORIZATION' => $token, 'CONTENT_TYPE' => 'application/webhook+json'], $body);
}

/**
 * @param  array<string, mixed>  $draft
 */
function notulenLlmReply(array|string $draft): array
{
    return ['choices' => [['message' => ['role' => 'assistant', 'content' => is_string($draft) ? $draft : json_encode($draft)]]]];
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config(['features.meetings' => true]);
    notulenConfigure();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 11:30', 'Asia/Jakarta'));
    $this->dimas = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->budi = User::factory()->withRole(Role::Anggota)->create(['name' => 'Budi Santoso']);
    $this->rina = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rina Wulandari']);
    $this->taker = User::factory()->withRole(Role::Anggota)->create(['name' => 'Sari Notulis']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')
        ->withParticipants([$this->budi, $this->rina, $this->taker])
        ->create([
            'title' => 'Koordinasi peluncuran Q4',
            'minute_taker_id' => $this->taker->id,
            'agenda' => ['Status pengiriman', 'Materi promosi'],
            'auto_minutes' => true,
        ]);
    $this->room = 'rk-'.strtolower($this->meeting->id).'-20261005';
    $this->base = '/rapat/'.$this->meeting->id.'/notulen-otomatis';
});

/**
 * @return array<string, mixed>
 */
function readyPayload(string $room, array $segments, string $session = 'sess-1', string $startedAt = '2026-10-05T03:00:00.000Z'): array
{
    return [
        'room' => $room, 'session' => $session, 'status' => 'ready', 'started_at' => $startedAt,
        'ended_at' => '2026-10-05T04:00:00.000Z', 'language' => 'id', 'model' => 'faster-whisper/large-v3-turbo',
        'duration_ms' => 3600000, 'segments' => $segments,
    ];
}

describe('ingestion from the worker', function () {
    it('stores a signed transcript, maps speakers and queues the AI draft', function () {
        Bus::fake([SummarizeMeetingTranscript::class]);

        notulenIngest(readyPayload($this->room, [
            ['speaker_identity' => $this->budi->id, 'speaker_name' => 'budi (lk)', 'start_ms' => 5000, 'end_ms' => 9000, 'text' => '  Gudang   terlambat tiga hari. '],
            ['speaker_identity' => $this->rina->id, 'speaker_name' => 'Rina', 'start_ms' => 1000, 'end_ms' => 4000, 'text' => 'Selamat pagi.'],
            ['speaker_identity' => 'tamu-x', 'speaker_name' => 'Tamu', 'start_ms' => 10000, 'end_ms' => 11000, 'text' => 'Halo'],
            ['speaker_identity' => $this->rina->id, 'speaker_name' => 'Rina', 'start_ms' => 12000, 'end_ms' => 13000, 'text' => '   '],
        ]))->assertOk()->assertJson(['status' => 'recorded']);

        $transcript = MeetingTranscript::query()->sole();
        expect($transcript->status)->toBe(TranscriptStatus::Summarizing)
            ->and($transcript->draft_status)->toBe(DraftStatus::Pending)
            ->and($transcript->occurrence_date->toDateString())->toBe('2026-10-05')
            ->and($transcript->purge_after->toDateString())->toBe('2027-01-03')
            ->and(array_column($transcript->segments, 'text'))->toBe(['Selamat pagi.', 'Gudang terlambat tiga hari.', 'Halo'])
            ->and($transcript->segments[1]['speaker_name'])->toBe('Budi Santoso')
            ->and($transcript->segments[1]['user_id'])->toBe($this->budi->id)
            ->and($transcript->segments[2]['user_id'])->toBeNull();
        Bus::assertDispatched(SummarizeMeetingTranscript::class);
    });

    it('refuses bad, tampered, stale and replayed signatures', function () {
        $payload = readyPayload($this->room, []);
        $body = json_encode($payload);

        notulenIngest($payload, secret: 'wrong-secret-wrong-secret-wrong-secret')->assertUnauthorized();
        notulenIngest($payload, timestamp: CarbonImmutable::now()->subMinutes(6)->getTimestamp())->assertUnauthorized();
        notulenIngest($payload, timestamp: CarbonImmutable::now()->addMinutes(6)->getTimestamp())->assertUnauthorized();

        $timestamp = CarbonImmutable::now()->getTimestamp();
        $signature = hash_hmac('sha256', $timestamp.'.'.$body, NOTULEN_SECRET);
        $this->call('POST', '/api/notulen/transcript', [], [], [], [
            'HTTP_X_NOTULEN_TIMESTAMP' => (string) $timestamp, 'HTTP_X_NOTULEN_SIGNATURE' => 'v1='.$signature,
        ], $body.' ')->assertUnauthorized();
        $this->call('POST', '/api/notulen/transcript', [], [], [], [], $body)->assertUnauthorized();

        notulenIngest($payload, timestamp: $timestamp)->assertOk();
        notulenIngest($payload, timestamp: $timestamp)->assertUnauthorized()->assertJson(['reason' => 'replayed']);
    });

    it('matches the worker signing scheme', function () {
        // Same vector as transcriber/tests/test_signing.py.
        expect(NotulenSignature::compute('key', 1700000000, '{}'))->toBe('9d713ed406bb7076d4123f0dc2c39d2df5c654ed4b0cd56b52c8b4c940bd63ae');
    });

    it('answers 404 when not configured and 422 for non-JSON', function () {
        notulenIngest([], body: 'not json')->assertStatus(422);
        config(['notulen.transcriber.url' => '']);
        notulenIngest(readyPayload($this->room, []))->assertNotFound();
    });

    it('ignores rooms of other meetings, meetings without auto_minutes and unknown statuses', function () {
        notulenIngest(readyPayload('rk-01hzzzzzzzzzzzzzzzzzzzzzzz-20261005', []))->assertJson(['status' => 'ignored']);
        notulenIngest([...readyPayload($this->room, []), 'status' => 'weird'])->assertJson(['status' => 'ignored']);
        $this->meeting->forceFill(['auto_minutes' => false])->save();
        notulenIngest(readyPayload($this->room, []))->assertJson(['status' => 'ignored']);
        expect(MeetingTranscript::query()->count())->toBe(0);
    });

    it('drops people who opted out, even if the worker sent them', function () {
        Bus::fake([SummarizeMeetingTranscript::class]);
        MeetingTranscriptConsent::query()->create(['meeting_id' => $this->meeting->id, 'user_id' => $this->budi->id, 'opted_out' => true]);

        notulenIngest(readyPayload($this->room, [
            ['speaker_identity' => $this->budi->id, 'speaker_name' => 'Budi', 'start_ms' => 1000, 'end_ms' => 2000, 'text' => 'Rahasia saya'],
            ['speaker_identity' => $this->rina->id, 'speaker_name' => 'Rina', 'start_ms' => 3000, 'end_ms' => 4000, 'text' => 'Oke'],
        ]))->assertOk();

        expect(array_column(MeetingTranscript::query()->sole()->segments, 'speaker_identity'))->toBe([$this->rina->id]);
    });

    it('merges a second recording session by wall clock and ignores a resent session', function () {
        Bus::fake([SummarizeMeetingTranscript::class]);
        $line = fn (User $u, int $ms, string $text): array => ['speaker_identity' => $u->id, 'speaker_name' => $u->name, 'start_ms' => $ms, 'end_ms' => $ms + 1000, 'text' => $text];

        notulenIngest(readyPayload($this->room, [$line($this->rina, 1000, 'Satu')]))->assertOk();
        notulenIngest(readyPayload($this->room, [$line($this->budi, 500, 'Dua')], 'sess-2', '2026-10-05T03:10:00.000Z'))->assertOk();
        // The worker retries with a fresh timestamp (same body, new signature).
        notulenIngest(readyPayload($this->room, [$line($this->budi, 500, 'Dua')], 'sess-2', '2026-10-05T03:10:00.000Z'), timestamp: now()->getTimestamp() + 1)->assertOk();

        $transcript = MeetingTranscript::query()->sole();
        expect(array_column($transcript->segments, 'text'))->toBe(['Satu', 'Dua'])
            ->and($transcript->segments[1]['start_ms'])->toBe(600500)
            ->and($transcript->sessions)->toBe(['sess-1', 'sess-2']);
    });

    it('shows recording/transcribing progress and failures', function () {
        notulenIngest(['room' => $this->room, 'session' => 's', 'status' => 'recording', 'started_at' => '2026-10-05T03:00:00Z'])->assertOk();
        expect(MeetingTranscript::query()->sole()->status)->toBe(TranscriptStatus::Recording);

        notulenIngest(['room' => $this->room, 'session' => 's', 'status' => 'transcribing'])->assertOk();
        expect(MeetingTranscript::query()->sole()->status)->toBe(TranscriptStatus::Transcribing);

        notulenIngest(['room' => $this->room, 'session' => 's', 'status' => 'failed', 'error' => 'Transkripsi gagal (RuntimeError).'])->assertOk();
        $transcript = MeetingTranscript::query()->sole();
        expect($transcript->status)->toBe(TranscriptStatus::Failed)->and($transcript->error)->toBe('Transkripsi gagal (RuntimeError).');
    });

    it('keeps the transcript without a draft when no API key is set', function () {
        notulenConfigure(llm: false);
        Http::fake();

        notulenIngest(readyPayload($this->room, [['speaker_identity' => $this->rina->id, 'speaker_name' => 'R', 'start_ms' => 0, 'end_ms' => 900, 'text' => 'Halo']]))->assertOk();

        $transcript = MeetingTranscript::query()->sole();
        expect($transcript->status)->toBe(TranscriptStatus::Ready)->and($transcript->draft_status)->toBe(DraftStatus::Disabled);
        Http::assertNothingSent();
    });
});

describe('LiveKit webhook → worker', function () {
    it('asks the worker to join with a hidden subscribe-only token and the opted-out people', function () {
        MeetingTranscriptConsent::query()->create(['meeting_id' => $this->meeting->id, 'user_id' => $this->budi->id, 'opted_out' => true]);
        Http::fake(['worker.test:8090/*' => Http::response(['status' => 'joining'], 202)]);

        notulenLiveKitWebhook(['event' => 'participant_joined', 'id' => 'EV_1', 'createdAt' => (string) now()->getTimestamp(),
            'room' => ['name' => $this->room], 'participant' => ['sid' => 'PA_1', 'identity' => $this->rina->id]])
            ->assertOk()->assertJson(['status' => 'queued']);
        // A second person within a minute does not ask again; the recorder's own join is ignored.
        notulenLiveKitWebhook(['event' => 'participant_joined', 'id' => 'EV_2', 'room' => ['name' => $this->room], 'participant' => ['identity' => $this->budi->id]])
            ->assertJson(['status' => 'ignored']);
        notulenLiveKitWebhook(['event' => 'participant_joined', 'id' => 'EV_3', 'room' => ['name' => $this->room], 'participant' => ['identity' => 'rk-notulen']])
            ->assertJson(['status' => 'ignored']);

        Http::assertSentCount(1);
        Http::assertSent(function (ClientRequest $request): bool {
            $body = $request->body();
            $data = json_decode($body, true);
            $timestamp = $request->header('X-Notulen-Timestamp')[0];
            JWT::$timestamp = CarbonImmutable::now()->getTimestamp();
            $claims = JWT::decode($data['token'], new Key(NOTULEN_LK_SECRET, 'HS256'));
            JWT::$timestamp = null;

            return $request->url() === 'http://worker.test:8090/rooms/'.$this->room.'/join'
                && $request->header('X-Notulen-Signature')[0] === 'v1='.hash_hmac('sha256', $timestamp.'.'.$body, NOTULEN_SECRET)
                && $data['action'] === 'join' && $data['room'] === $this->room && $data['exclude'] === [$this->budi->id]
                && $claims->sub === 'rk-notulen' && $claims->kind === 'agent'
                && $claims->video->hidden === true && $claims->video->canSubscribe === true
                && $claims->video->canPublish === false && $claims->video->canPublishData === false
                && $claims->video->room === $this->room;
        });
    });

    it('asks the worker to finish when the room ends', function () {
        Http::fake(['worker.test:8090/*' => Http::response(['status' => 'finishing'], 202)]);

        notulenLiveKitWebhook(['event' => 'room_finished', 'id' => 'EV_9', 'room' => ['name' => $this->room]])->assertJson(['status' => 'queued']);

        Http::assertSent(fn (ClientRequest $r): bool => $r->url() === 'http://worker.test:8090/rooms/'.$this->room.'/finish');
    });

    it('does nothing for meetings without auto_minutes, bad signatures or duplicates', function () {
        Http::fake();
        $this->meeting->forceFill(['auto_minutes' => false])->save();
        notulenLiveKitWebhook(['event' => 'participant_joined', 'id' => 'EV_4', 'room' => ['name' => $this->room], 'participant' => ['identity' => $this->rina->id]])
            ->assertJson(['status' => 'ignored']);
        notulenLiveKitWebhook(['event' => 'participant_joined', 'id' => 'EV_4', 'room' => ['name' => $this->room], 'participant' => ['identity' => $this->rina->id]])
            ->assertJson(['status' => 'duplicate']);
        $this->call('POST', '/api/notulen/livekit', [], [], [], ['HTTP_AUTHORIZATION' => 'bad'], '{}')->assertUnauthorized();
        Http::assertNothingSent();
    });
});

describe('policy and settings', function () {
    it('applies the access matrix', function (string $who, array $expected) {
        $direksi = User::factory()->withRole(Role::Direksi)->create();
        $this->meeting->forceFill(['leadership' => true])->save();
        $users = [
            'organizer' => $this->dimas, 'minute taker' => $this->taker, 'participant' => $this->rina,
            'leadership observer' => $direksi, 'outsider' => $this->outsider,
            'other company' => User::factory()->withRole(Role::Anggota)->create(['company_id' => Company::factory()->create()->id]),
        ];
        $verdicts = [];

        foreach (['status', 'view', 'consent', 'configure', 'manage'] as $ability) {
            $verdicts[$ability] = meetingVerdict($users[$who], $ability, [MeetingTranscript::class, $this->meeting->fresh()]);
        }

        expect($verdicts)->toBe($expected);
    })->with([
        'organizer' => ['organizer', ['status' => 'allow', 'view' => 'allow', 'consent' => 'allow', 'configure' => 'allow', 'manage' => 'allow']],
        'minute taker' => ['minute taker', ['status' => 'allow', 'view' => 'allow', 'consent' => 'allow', 'configure' => 'deny', 'manage' => 'allow']],
        'participant' => ['participant', ['status' => 'allow', 'view' => 'allow', 'consent' => 'allow', 'configure' => 'deny', 'manage' => 'deny']],
        'leadership observer' => ['leadership observer', ['status' => 'allow', 'view' => 'deny', 'consent' => 'deny', 'configure' => 'deny', 'manage' => 'deny']],
        'outsider' => ['outsider', ['status' => 'hidden', 'view' => 'hidden', 'consent' => 'hidden', 'configure' => 'hidden', 'manage' => 'hidden']],
        'other company' => ['other company', ['status' => 'hidden', 'view' => 'hidden', 'consent' => 'hidden', 'configure' => 'hidden', 'manage' => 'hidden']],
    ]);

    it('hides the transcript from leadership observers and 404s for outsiders over HTTP', function () {
        MeetingTranscript::factory()->ready([[$this->rina->id, 'Rina', 1, 'Halo']])->create(['meeting_id' => $this->meeting->id]);
        $direksi = User::factory()->withRole(Role::Direksi)->create();
        $this->meeting->forceFill(['leadership' => true])->save();

        $this->actingAs($direksi)->getJson($this->base.'/status')->assertOk()->assertJsonPath('draft', null)->assertJsonPath('can_view_transcript', false);
        $this->actingAs($direksi)->getJson($this->base.'/transkrip')->assertForbidden();
        $this->actingAs($this->outsider)->getJson($this->base.'/status')->assertNotFound();
        $this->actingAs($this->outsider)->get($this->base)->assertNotFound();
    });

    it('lets the organizer switch auto_minutes on video meetings only, audited', function () {
        $this->meeting->forceFill(['auto_minutes' => false])->save();

        $this->actingAs($this->dimas)->putJson($this->base.'/pengaturan', ['auto_minutes' => true])
            ->assertOk()->assertJsonPath('auto_minutes', true)->assertJsonPath('notice', 'Notulen otomatis aktif — suara Anda ditranskrip setelah rapat');
        expect(AuditLog::query()->where('action', 'meeting.auto_minutes_changed')->count())->toBe(1);
        $this->actingAs($this->rina)->putJson($this->base.'/pengaturan', ['auto_minutes' => false])->assertForbidden();

        $meet = Meeting::factory()->by($this->dimas)->at('2026-10-06 10:00')->withParticipants([$this->rina])->create();
        $this->actingAs($this->dimas)->putJson('/rapat/'.$meet->id.'/notulen-otomatis/pengaturan', ['auto_minutes' => true])->assertForbidden();

        config(['notulen.transcriber.url' => '']);
        $this->actingAs($this->dimas)->putJson($this->base.'/pengaturan', ['auto_minutes' => false])->assertOk()->assertJsonPath('available', false);
        $this->actingAs($this->dimas)->putJson($this->base.'/pengaturan', ['auto_minutes' => true])->assertUnprocessable();
    });
});

describe('consent ("Jangan transkrip suara saya")', function () {
    it('stores the choice, returns the LiveKit attribute and tells a recording worker', function () {
        MeetingTranscript::factory()->create(['meeting_id' => $this->meeting->id, 'status' => TranscriptStatus::Recording]);
        Http::fake(['worker.test:8090/*' => Http::response(['status' => 'applied'])]);

        $this->actingAs($this->budi)->putJson($this->base.'/persetujuan', ['opted_out' => true])
            ->assertOk()->assertExactJson(['opted_out' => true, 'attributes' => ['rk_notulen_optout' => '1']]);

        expect(MeetingTranscriptConsent::query()->where('user_id', $this->budi->id)->value('opted_out'))->toBeTrue()
            ->and(AuditLog::query()->where('action', 'meeting.transcript_consent_changed')->count())->toBe(1);
        Http::assertSent(function (ClientRequest $r): bool {
            $data = json_decode($r->body(), true);

            return str_ends_with($r->url(), '/rooms/'.$this->room.'/exclude') && $data['identity'] === $this->budi->id && $data['excluded'] === true;
        });

        $this->actingAs($this->budi)->getJson($this->base.'/status')->assertJsonPath('consent.opted_out', true);
        $this->actingAs($this->budi)->putJson($this->base.'/persetujuan', ['opted_out' => false])->assertJsonPath('attributes.rk_notulen_optout', '0');
        $this->actingAs($this->outsider)->putJson($this->base.'/persetujuan', ['opted_out' => true])->assertNotFound();
    });

    it('removes the person from transcripts not yet in the minutes and re-runs the draft', function () {
        Bus::fake([SummarizeMeetingTranscript::class]);
        Http::fake();
        $transcript = MeetingTranscript::factory()
            ->ready([[$this->budi->id, 'Budi', 1, 'Saya'], [$this->rina->id, 'Rina', 5, 'Kami']], ['ringkasan' => 'x'])
            ->create(['meeting_id' => $this->meeting->id]);

        $this->actingAs($this->budi)->putJson($this->base.'/persetujuan', ['opted_out' => true])->assertOk();

        $transcript->refresh();
        expect(array_column($transcript->segments, 'text'))->toBe(['Kami'])
            ->and($transcript->draft_status)->toBe(DraftStatus::Pending)
            ->and($transcript->draft)->toBeNull();
        Bus::assertDispatched(SummarizeMeetingTranscript::class);
    });
});

describe('AI summary', function () {
    beforeEach(function () {
        $this->transcript = MeetingTranscript::factory()->ready([
            [$this->dimas->id, 'Dimas Pratama', 0, 'Selamat pagi, kita mulai.'],
            [$this->budi->id, 'Budi Santoso', 10, 'Pengiriman terlambat tiga hari.'],
            [$this->dimas->id, 'Dimas Pratama', 20, 'Budi tolong hubungi vendor sebelum Jumat.'],
            [$this->rina->id, 'Rina Wulandari', 30, 'Kampanye mulai 20 Oktober, sepakat.'],
        ])->create(['meeting_id' => $this->meeting->id, 'status' => TranscriptStatus::Summarizing, 'draft_status' => DraftStatus::Pending]);
        $this->validDraft = [
            'ringkasan' => 'Rapat membahas pengiriman dan kampanye.',
            'agenda' => [[
                'judul' => 'Status pengiriman',
                'poin' => [['teks' => 'Pengiriman terlambat tiga hari.', 'sumber' => [1, 99]]],
                'keputusan' => [],
                'tindak_lanjut' => [
                    ['judul' => 'Hubungi vendor logistik', 'penanggung_jawab' => 'Pak Budi', 'tenggat' => '2026-10-09', 'sumber' => [2]],
                    ['judul' => 'Kirim laporan', 'penanggung_jawab' => 'Joko Widodo', 'tenggat' => 'Jumat depan', 'sumber' => []],
                ],
            ], [
                'judul' => 'Materi promosi',
                'poin' => [],
                'keputusan' => [['teks' => 'Kampanye mulai 20 Oktober.', 'sumber' => [3]]],
                'tindak_lanjut' => [],
            ]],
            'perlu_dicek' => ['Anggaran belum jelas.'],
        ];
    });

    it('builds a validated draft and never invents assignees', function () {
        Http::fake(['llm.test/*' => Http::response(notulenLlmReply($this->validDraft))]);

        dispatch_sync(new SummarizeMeetingTranscript($this->meeting->id, '2026-10-05'));

        $transcript = $this->transcript->refresh();
        $draft = $transcript->draft;
        expect($transcript->status)->toBe(TranscriptStatus::Ready)
            ->and($transcript->draft_status)->toBe(DraftStatus::Ready)
            ->and($transcript->draft_model)->toBe('deepseek-chat')
            ->and($draft['agenda'][0]['poin'][0]['sumber'])->toBe([['i' => 1, 'start_ms' => 10000]])
            ->and($draft['tindak_lanjut'][0])->toMatchArray([
                'id' => 'tl-1', 'judul' => 'Hubungi vendor logistik', 'agenda' => 'Status pengiriman',
                'penanggung_jawab' => ['user_id' => $this->budi->id, 'nama' => 'Budi Santoso'], 'tenggat' => '2026-10-09',
            ])
            ->and($draft['tindak_lanjut'][1]['penanggung_jawab'])->toBeNull()
            ->and($draft['tindak_lanjut'][1]['penanggung_jawab_teks'])->toBe('Joko Widodo')
            ->and($draft['tindak_lanjut'][1]['tenggat'])->toBeNull()
            ->and($draft['keputusan'][0])->toMatchArray(['teks' => 'Kampanye mulai 20 Oktober.', 'agenda' => 'Materi promosi'])
            ->and($draft['perlu_dicek'])->toContain('Anggaran belum jelas.')
            ->and(implode(' ', $draft['perlu_dicek']))->toContain('Joko Widodo')->toContain('Jumat depan');

        Http::assertSent(function (ClientRequest $r): bool {
            $prompt = $r['messages'][1]['content'];

            return $r->url() === 'https://llm.test/chat/completions' && $r->hasHeader('Authorization', 'Bearer test-key')
                && $r['model'] === 'deepseek-chat' && $r['response_format'] === ['type' => 'json_object']
                && str_contains($prompt, '[1] 00:10 Budi Santoso: Pengiriman terlambat tiga hari.')
                && str_contains($prompt, '- Rina Wulandari') && str_contains($prompt, 'Senin');
        });
    });

    it('repairs fenced JSON with trailing commas locally, and asks the model once for broken output', function () {
        $fenced = "Berikut hasilnya:\n```json\n".'{"ringkasan": "Singkat.", "agenda": [], "perlu_dicek": [],}'."\n```";
        Http::fakeSequence('llm.test/*')
            ->push(notulenLlmReply($fenced))
            ->push(notulenLlmReply('maaf, tidak bisa'))
            ->push(notulenLlmReply(['ringkasan' => 'Diperbaiki.', 'agenda' => []]));

        dispatch_sync(new SummarizeMeetingTranscript($this->meeting->id, '2026-10-05'));
        expect($this->transcript->refresh()->draft['ringkasan'])->toBe('Singkat.');

        $this->transcript->forceFill(['draft_status' => DraftStatus::Pending, 'draft' => null])->save();
        dispatch_sync(new SummarizeMeetingTranscript($this->meeting->id, '2026-10-05'));
        expect($this->transcript->refresh()->draft['ringkasan'])->toBe('Diperbaiki.');
        Http::assertSentCount(3);
    });

    it('marks the draft failed (transcript kept) when the reply stays invalid or the API errors', function () {
        Http::fakeSequence('llm.test/*')
            ->push(notulenLlmReply('bukan json'))
            ->push(notulenLlmReply('masih bukan json'))
            ->push(['error' => 'x'], 500);
        dispatch_sync(new SummarizeMeetingTranscript($this->meeting->id, '2026-10-05'));
        $transcript = $this->transcript->refresh();
        expect($transcript->draft_status)->toBe(DraftStatus::Failed)
            ->and($transcript->status)->toBe(TranscriptStatus::Ready)
            ->and($transcript->draft_error)->toBe('Ringkasan AI tidak berbentuk JSON yang valid.')
            ->and($transcript->segments)->toHaveCount(4);

        $transcript->forceFill(['draft_status' => DraftStatus::Pending])->save();
        dispatch_sync(new SummarizeMeetingTranscript($this->meeting->id, '2026-10-05'));
        expect($transcript->refresh()->draft_error)->toBe('Layanan ringkasan AI HTTP 500.');
    });

    it('summarizes long transcripts map-reduce', function () {
        config(['notulen.llm.chunk_chars' => 2000]);
        $lines = [];

        for ($i = 0; $i < 60; $i++) {
            $lines[] = [$this->rina->id, 'Rina Wulandari', $i * 10, str_repeat("Kalimat {$i} tentang pengiriman. ", 4)];
        }

        $this->transcript->forceFill(['segments' => MeetingTranscript::factory()->ready($lines)->make()->segments])->save();
        Http::fake(['llm.test/*' => Http::response(notulenLlmReply(['ringkasan' => 'Gabungan.', 'agenda' => []]))]);

        dispatch_sync(new SummarizeMeetingTranscript($this->meeting->id, '2026-10-05'));

        $requests = Http::recorded()->all();
        expect(count($requests))->toBeGreaterThan(2)
            ->and($requests[0][0]['messages'][1]['content'])->toContain('Ini bagian 1 dari')
            ->and($requests[count($requests) - 1][0]['messages'][1]['content'])->toContain('Gabungkan menjadi SATU notulen')
            ->and($this->transcript->refresh()->draft['ringkasan'])->toBe('Gabungan.');

        foreach (array_slice($requests, 0, -1) as [$request]) {
            expect(mb_strlen($request['messages'][1]['content']))->toBeLessThan(2000 + 1500);
        }
    });

    it('never overwrites a draft that was inserted meanwhile', function () {
        $this->transcript->forceFill(['draft_status' => DraftStatus::Inserted])->save();
        Http::fake();
        dispatch_sync(new SummarizeMeetingTranscript($this->meeting->id, '2026-10-05'));
        Http::assertNothingSent();
        expect($this->transcript->refresh()->draft_status)->toBe(DraftStatus::Inserted);
    });
});

describe('draft actions', function () {
    beforeEach(function () {
        $this->transcript = MeetingTranscript::factory()->ready([
            [$this->budi->id, 'Budi Santoso', 10, 'Pengiriman terlambat.'],
        ], [
            'ringkasan' => 'Ringkasan rapat.',
            'agenda' => [
                ['judul' => 'Status pengiriman', 'poin' => [['teks' => 'Pengiriman terlambat tiga hari.', 'sumber' => []]]],
                ['judul' => 'Lain-lain', 'poin' => [['teks' => 'Pelatihan Selasa.', 'sumber' => []]]],
            ],
            'keputusan' => [['teks' => 'Kampanye mulai 20 Oktober.', 'agenda' => null, 'sumber' => []], ['teks' => 'Sudah diputuskan', 'agenda' => null, 'sumber' => []]],
            'tindak_lanjut' => [
                ['id' => 'tl-1', 'judul' => 'Hubungi vendor', 'agenda' => null, 'penanggung_jawab' => ['user_id' => $this->budi->id, 'nama' => 'Budi Santoso'], 'penanggung_jawab_teks' => 'Budi', 'tenggat' => '2026-10-09', 'sumber' => [], 'action_item_id' => null, 'task' => null],
                ['id' => 'tl-2', 'judul' => 'Siapkan anggaran', 'agenda' => null, 'penanggung_jawab' => null, 'penanggung_jawab_teks' => null, 'tenggat' => null, 'sumber' => [], 'action_item_id' => null, 'task' => null],
            ],
            'perlu_dicek' => [],
        ])->create(['meeting_id' => $this->meeting->id]);
    });

    it('inserts the draft without clobbering what the notulis wrote', function () {
        $this->actingAs($this->taker)->putJson('/rapat/'.$this->meeting->id.'/notulen', [
            'attendance' => [['user_id' => $this->budi->id, 'present' => true]],
            'sections' => [['title' => 'Status pengiriman', 'body' => 'Catatan notulis sendiri.'], ['title' => 'Materi promosi', 'body' => '']],
            'decisions' => ['Sudah diputuskan'],
        ])->assertOk();

        $this->actingAs($this->taker)->postJson($this->base.'/masukkan')->assertOk()
            ->assertJsonPath('minutes_href', '/rapat/'.$this->meeting->id.'/notulen?tanggal=2026-10-05')
            ->assertJsonCount(2, 'action_item_ids');

        $minutes = MeetingMinutes::query()->sole();
        $marker = '[Draf otomatis — periksa sebelum final]';
        expect($minutes->sections[0])->toEqual(['title' => 'Status pengiriman', 'body' => "Catatan notulis sendiri.\n\n{$marker}\n• Pengiriman terlambat tiga hari."])
            ->and($minutes->sections[1])->toEqual(['title' => 'Materi promosi', 'body' => ''])
            ->and($minutes->sections[2])->toEqual(['title' => 'Lain-lain', 'body' => "{$marker}\n• Pelatihan Selasa."])
            ->and($minutes->sections[3]['title'])->toBe('Ringkasan (draf otomatis)')
            ->and($minutes->decisions)->toBe(['Sudah diputuskan', 'Kampanye mulai 20 Oktober. (draf otomatis)'])
            ->and($minutes->attendance)->toEqual([['user_id' => $this->budi->id, 'present' => true]]);

        $items = MeetingActionItem::query()->orderBy('position')->get();
        expect($items->pluck('text')->all())->toBe(['Hubungi vendor', 'Siapkan anggaran'])
            ->and($items[0]->assignee_id)->toBe($this->budi->id)
            ->and($items[0]->due_date->toDateString())->toBe('2026-10-09');

        $transcript = $this->transcript->refresh();
        expect($transcript->draft_status)->toBe(DraftStatus::Inserted)
            ->and($transcript->inserted_by)->toBe($this->taker->id)
            ->and($transcript->draft['tindak_lanjut'][0]['action_item_id'])->toBe($items[0]->id)
            ->and(AuditLog::query()->where('action', 'meeting.transcript_draft_inserted')->count())->toBe(1);

        $this->actingAs($this->taker)->postJson($this->base.'/masukkan')->assertStatus(409);
        $this->actingAs($this->rina)->postJson($this->base.'/masukkan')->assertForbidden();
    });

    it('refuses to insert into final minutes', function () {
        MeetingMinutes::query()->create([
            'meeting_id' => $this->meeting->id, 'occurrence_date' => '2026-10-05', 'status' => 'final',
            'attendance' => [], 'sections' => [], 'decisions' => [], 'finalized_at' => now(), 'finalized_by' => $this->taker->id,
        ]);

        $this->actingAs($this->taker)->postJson($this->base.'/masukkan')->assertStatus(409)->assertJson(['message' => 'Notulen sudah final. Buka kembali draf notulen dulu.']);
        expect($this->transcript->refresh()->draft_status)->toBe(DraftStatus::Ready);
    });

    it('turns one suggestion into a task through the existing flow', function () {
        $workspace = Workspace::factory()->ownedBy($this->dimas)->withMember($this->taker)->create(['key' => 'OPS']);
        $this->meeting->forceFill(['workspace_id' => $workspace->id])->save();

        $response = $this->actingAs($this->taker)->postJson($this->base.'/tindak-lanjut/tl-1/tugas')->assertOk();

        $item = MeetingActionItem::query()->sole();
        expect($item->task_id)->not->toBeNull()
            ->and($response->json('task.key'))->toStartWith('OPS-')
            ->and($response->json('suggestion.action_item_id'))->toBe($item->id)
            ->and($this->transcript->refresh()->draft['tindak_lanjut'][0]['task']['id'])->toBe($item->task_id);

        // Idempotent: a second click creates nothing new.
        $this->actingAs($this->taker)->postJson($this->base.'/tindak-lanjut/tl-1/tugas')->assertOk();
        expect(MeetingActionItem::query()->count())->toBe(1);
        $this->actingAs($this->taker)->postJson($this->base.'/tindak-lanjut/tl-9/tugas')->assertStatus(409);
    });

    it('asks for a workspace when the meeting has none', function () {
        $this->actingAs($this->taker)->postJson($this->base.'/tindak-lanjut/tl-2/tugas')->assertUnprocessable()->assertJsonValidationErrors('workspace_id');
    });

    it('discards and re-runs the draft', function () {
        Bus::fake([SummarizeMeetingTranscript::class]);

        $this->actingAs($this->taker)->deleteJson($this->base.'/draf')->assertOk()->assertJsonPath('draft.status', 'discarded')->assertJsonPath('draft.ringkasan', '');
        $this->actingAs($this->taker)->postJson($this->base.'/masukkan')->assertStatus(409);
        $this->actingAs($this->taker)->postJson($this->base.'/ringkas-ulang')->assertOk()->assertJsonPath('draft.status', 'pending')->assertJsonPath('transcript.status', 'summarizing');
        Bus::assertDispatched(SummarizeMeetingTranscript::class);

        notulenConfigure(llm: false);
        $this->transcript->forceFill(['draft_status' => DraftStatus::Failed, 'status' => TranscriptStatus::Ready])->save();
        $this->actingAs($this->taker)->postJson($this->base.'/ringkas-ulang')->assertStatus(409);
    });

    it('serves the transcript to participants with an audit entry', function () {
        $this->actingAs($this->rina)->getJson($this->base.'/transkrip')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('segments.0', ['i' => 0, 'speaker_identity' => $this->budi->id, 'user_id' => $this->budi->id, 'speaker_name' => 'Budi Santoso', 'start_ms' => 10000, 'end_ms' => 14000, 'text' => 'Pengiriman terlambat.'])
            ->assertJsonPath('speakers.0.seconds', 4);
        $this->actingAs($this->rina)->getJson($this->base.'/transkrip')->assertOk();

        expect(AuditLog::query()->where('action', 'meeting.transcript_viewed')->count())->toBe(1);
    });

    it('renders the review page with the summary but without transcript text', function () {
        $this->actingAs($this->rina)->get($this->base)->assertOk()
            ->assertInertia(fn ($page) => $page->component('meetings/notulen-otomatis')
                ->where('meeting.title', 'Koordinasi peluncuran Q4')
                ->where('notulen.transcript.segment_count', 1)
                ->where('notulen.draft.tindak_lanjut.0.id', 'tl-1')
                ->missing('notulen.segments'));
    });
});

it('purges transcripts after their retention', function () {
    $old = MeetingTranscript::factory()->ready()->create(['meeting_id' => $this->meeting->id, 'purge_after' => now()->subMinute()]);
    $other = Meeting::factory()->by($this->dimas)->video()->at('2026-10-06 10:00')->create();
    $fresh = MeetingTranscript::factory()->ready()->create(['meeting_id' => $other->id, 'occurrence_date' => '2026-10-06', 'purge_after' => now()->addDay()]);

    expect((new PurgeExpiredMeetingTranscripts)->handle())->toBe(1)
        ->and(MeetingTranscript::query()->pluck('id')->all())->toBe([$fresh->id])
        ->and(MeetingTranscript::query()->find($old->id))->toBeNull();
});

it('keeps the status endpoint and review page within a query budget as the transcript grows', function () {
    $series = Meeting::factory()->by($this->dimas)->video()->at('2026-10-05 10:00')
        ->recurring(Recurrence::Weekdays)->withParticipants([$this->rina, $this->budi])->create(['auto_minutes' => true]);
    $count = function (string $url): int {
        $this->actingAs($this->rina)->get($url)->assertOk(); // warm caches (permissions, config)
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($this->rina)->get($url)->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $queries;
    };
    $base = '/rapat/'.$series->id.'/notulen-otomatis';
    MeetingTranscript::factory()->ready([[$this->rina->id, 'Rina', 1, 'Satu']])->create(['meeting_id' => $series->id]);
    $small = [$count($base.'/status?tanggal=2026-10-05'), $count($base.'?tanggal=2026-10-05')];

    $lines = [];
    for ($i = 0; $i < 300; $i++) {
        $lines[] = [$i % 2 === 0 ? $this->rina->id : $this->budi->id, 'X', $i, 'Kalimat '.$i];
    }
    MeetingTranscript::query()->update(['segments' => json_encode(MeetingTranscript::factory()->ready($lines)->make()->segments)]);
    $big = [$count($base.'/status?tanggal=2026-10-05'), $count($base.'?tanggal=2026-10-05')];

    expect($big)->toBe($small)
        ->and($small[0])->toBeLessThanOrEqual(14)
        ->and($small[1])->toBeLessThanOrEqual(26);
});
