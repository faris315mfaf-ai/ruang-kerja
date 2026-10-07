<?php

use App\Domain\Organization\Enums\Role;
use App\Models\Meeting;
use App\Models\MeetingAttendance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Notification;

/*
 * Audit rapat 2026-10 (docs/security/AUDIT-RAPAT-2026-10.md, R-02): the
 * LiveKit webhook remembers an event id only once it has been processed. A
 * failure (database hiccup, two concurrent requests for one participant) must
 * not turn LiveKit's retry into a "duplicate", or the attendance row stays
 * open forever.
 */
const AUDIT_LK_KEY = 'auditkey';
const AUDIT_LK_SECRET = 'audit-secret-that-is-at-least-32-characters';

/**
 * @param  array<string, mixed>  $event
 */
function auditPostLiveKit(array $event)
{
    $body = json_encode($event, JSON_THROW_ON_ERROR);
    $now = CarbonImmutable::now()->getTimestamp();
    $token = JWT::encode([
        'iss' => AUDIT_LK_KEY,
        'nbf' => $now,
        'exp' => $now + 300,
        'sha256' => base64_encode(hash('sha256', $body, true)),
    ], AUDIT_LK_SECRET, 'HS256');

    return test()->call('POST', '/api/livekit/webhook', [], [], [], [
        'HTTP_AUTHORIZATION' => $token,
        'CONTENT_TYPE' => 'application/webhook+json',
    ], $body);
}

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config([
        'features.meetings' => true,
        'livekit.url' => 'wss://rapat.example.test',
        'livekit.api_key' => AUDIT_LK_KEY,
        'livekit.api_secret' => AUDIT_LK_SECRET,
    ]);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:05', 'Asia/Jakarta'));
    $this->organizer = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->guest = User::factory()->withRole(Role::Anggota)->create();
    $this->meeting = Meeting::factory()->by($this->organizer)->video()->at('2026-10-05 10:00')
        ->withParticipants([$this->guest])->create();
    $this->event = [
        'event' => 'participant_joined',
        'id' => 'EV_retry',
        'createdAt' => (string) CarbonImmutable::now()->getTimestamp(),
        'room' => ['name' => 'rk-'.strtolower($this->meeting->id).'-20261005'],
        'participant' => ['sid' => 'PA_retry', 'identity' => $this->guest->id],
    ];
});

it('processes LiveKit\'s retry when the first delivery failed', function () {
    $fail = true;
    MeetingAttendance::creating(function () use (&$fail): void {
        if ($fail) {
            $fail = false;

            throw new RuntimeException('database hiccup');
        }
    });

    $this->withoutExceptionHandling();
    expect(fn () => auditPostLiveKit($this->event))->toThrow(RuntimeException::class, 'database hiccup');
    expect(MeetingAttendance::query()->count())->toBe(0);

    auditPostLiveKit($this->event)->assertOk()->assertJsonPath('status', 'recorded');
    expect(MeetingAttendance::query()->sole()->user_id)->toBe($this->guest->id);

    // Once processed, a replay is still a duplicate.
    auditPostLiveKit($this->event)->assertOk()->assertJsonPath('status', 'duplicate');
});
