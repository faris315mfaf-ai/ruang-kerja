<?php

use App\Http\Middleware\IdempotentRequests;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

/*
| API v1 — Idempotency-Key (aplikasi offline-first, 14 Okt 2026): tulis yang
| diulang dengan kunci yang sama diputar ulang, tidak dijalankan dua kali.
| Rute uji dipasang di grup yang sama dengan API (auth:sanctum + middleware).
*/

beforeEach(function () {
    $this->calls = 0;
    $counter = function (): int {
        return ++$this->calls;
    };

    Route::middleware(['api', 'auth:sanctum', IdempotentRequests::class])->prefix('api/v1/_idem')->group(function () use ($counter): void {
        Route::post('ok', fn () => response()->json(['n' => $counter()], 201));
        Route::put('ok', fn () => response()->json(['n' => $counter()]));
        Route::post('other', fn () => response()->json(['n' => $counter()], 201));
        Route::post('boom', fn () => response()->json(['n' => $counter()], 500));
        Route::post('limited', fn () => response()->json(['n' => $counter()], 429));
        Route::post('invalid', fn () => response()->json(['message' => 'Tidak valid.', 'n' => $counter()], 422));
        Route::post('missing', fn () => response()->json(['n' => $counter()], 404));
        Route::post('big', fn () => response()->json(['n' => $counter(), 'pad' => str_repeat('x', IdempotentRequests::MAX_BODY_BYTES + 10)], 201));
        Route::post('empty', function () use ($counter) {
            $counter();

            return response()->noContent();
        });
        Route::post('crash', function () use ($counter): never {
            $counter();

            throw new RuntimeException('kaboom');
        });
    });

    $this->user = User::factory()->create();
    Sanctum::actingAs($this->user);
});

/** @return array<string, string> */
function idem(?string $key = null): array
{
    return ['Idempotency-Key' => $key ?? (string) Str::uuid()];
}

test('a retried write with the same key replays the first response and never runs twice', function () {
    $headers = idem();

    $first = $this->postJson('/api/v1/_idem/ok', [], $headers)->assertCreated()->assertJsonPath('n', 1);
    expect($first->headers->has(IdempotentRequests::REPLAY_HEADER))->toBeFalse();

    $this->postJson('/api/v1/_idem/ok', [], $headers)
        ->assertCreated()
        ->assertJsonPath('n', 1)
        ->assertHeader(IdempotentRequests::REPLAY_HEADER, 'true');
    $this->postJson('/api/v1/_idem/ok', [], $headers)->assertCreated()->assertJsonPath('n', 1);

    expect($this->calls)->toBe(1)
        ->and(DB::table('api_idempotency_keys')->count())->toBe(1);

    $row = DB::table('api_idempotency_keys')->sole();
    expect($row->status)->toBe(201)->and($row->completed_at)->not->toBeNull()->and($row->user_id)->toBe($this->user->id);
});

test('requests without a key, and reads, are untouched', function () {
    $this->postJson('/api/v1/_idem/ok')->assertJsonPath('n', 1);
    $this->postJson('/api/v1/_idem/ok')->assertJsonPath('n', 2);

    expect(DB::table('api_idempotency_keys')->count())->toBe(0);

    $this->getJson('/api/v1/auth/saya', idem())->assertOk();
    expect(DB::table('api_idempotency_keys')->count())->toBe(0);
});

test('PUT and an empty 204 are replayed too', function () {
    $key = idem();
    $this->putJson('/api/v1/_idem/ok', [], $key)->assertOk()->assertJsonPath('n', 1);
    $this->putJson('/api/v1/_idem/ok', [], $key)->assertOk()->assertJsonPath('n', 1)->assertHeader('Idempotent-Replayed', 'true');

    $empty = idem();
    $this->postJson('/api/v1/_idem/empty', [], $empty)->assertNoContent();
    $this->postJson('/api/v1/_idem/empty', [], $empty)->assertNoContent()->assertHeader('Idempotent-Replayed', 'true');

    expect($this->calls)->toBe(2);
});

test('a key reused for another method or path is an idempotency_conflict', function () {
    $headers = idem();
    $this->postJson('/api/v1/_idem/ok', [], $headers)->assertCreated();

    $this->postJson('/api/v1/_idem/other', [], $headers)
        ->assertStatus(422)
        ->assertJsonPath('reason', 'idempotency_conflict');
    $this->putJson('/api/v1/_idem/ok', [], $headers)
        ->assertStatus(422)
        ->assertJsonPath('reason', 'idempotency_conflict');

    expect($this->calls)->toBe(1);
});

test('a key still being processed answers 409 idempotency_in_progress with Retry-After', function () {
    $key = 'in-flight-key-123456';
    DB::table('api_idempotency_keys')->insert([
        'id' => (string) Str::ulid(),
        'user_id' => $this->user->id,
        'key' => $key,
        'method' => 'POST',
        'path_hash' => hash('sha256', 'api/v1/_idem/ok'),
        'created_at' => now(),
    ]);

    $this->postJson('/api/v1/_idem/ok', [], idem($key))
        ->assertStatus(409)
        ->assertJsonPath('reason', 'idempotency_in_progress')
        ->assertHeader('Retry-After', '2');

    expect($this->calls)->toBe(0);
});

test('an abandoned claim older than two minutes is taken over', function () {
    $key = 'abandoned-key-1234567';
    DB::table('api_idempotency_keys')->insert([
        'id' => (string) Str::ulid(),
        'user_id' => $this->user->id,
        'key' => $key,
        'method' => 'POST',
        'path_hash' => hash('sha256', 'api/v1/_idem/ok'),
        'created_at' => now()->subSeconds(IdempotentRequests::STALE_AFTER_SECONDS + 5),
    ]);

    $this->postJson('/api/v1/_idem/ok', [], idem($key))->assertCreated()->assertJsonPath('n', 1);
    $this->postJson('/api/v1/_idem/ok', [], idem($key))->assertHeader('Idempotent-Replayed', 'true');

    expect($this->calls)->toBe(1);
});

test('5xx, 429 and thrown exceptions are not stored: the claim is released and a retry runs again', function () {
    foreach (['boom' => 500, 'limited' => 429] as $path => $status) {
        $key = idem();
        $this->postJson("/api/v1/_idem/{$path}", [], $key)->assertStatus($status);

        expect(DB::table('api_idempotency_keys')->count())->toBe(0);

        $this->postJson("/api/v1/_idem/{$path}", [], $key)->assertStatus($status);
    }

    expect($this->calls)->toBe(4);

    $key = idem();
    $this->postJson('/api/v1/_idem/crash', [], $key)->assertStatus(500);
    expect(DB::table('api_idempotency_keys')->count())->toBe(0);
    $this->postJson('/api/v1/_idem/crash', [], $key)->assertStatus(500);
    expect($this->calls)->toBe(6);
});

test('deterministic 4xx (422, 404) are stored and replayed', function () {
    $invalid = idem();
    $this->postJson('/api/v1/_idem/invalid', [], $invalid)->assertStatus(422)->assertJsonPath('n', 1);
    $this->postJson('/api/v1/_idem/invalid', [], $invalid)
        ->assertStatus(422)
        ->assertJsonPath('n', 1)
        ->assertJsonPath('message', 'Tidak valid.')
        ->assertHeader('Idempotent-Replayed', 'true');

    $missing = idem();
    $this->postJson('/api/v1/_idem/missing', [], $missing)->assertNotFound();
    $this->postJson('/api/v1/_idem/missing', [], $missing)->assertNotFound()->assertHeader('Idempotent-Replayed', 'true');

    expect($this->calls)->toBe(2);
});

test('an oversized successful response is stored without its body and replayed as a confirmation', function () {
    $key = idem();
    $this->postJson('/api/v1/_idem/big', [], $key)->assertCreated();

    $row = DB::table('api_idempotency_keys')->sole();
    expect($row->status)->toBe(201)->and($row->response_body)->toBeNull()->and($row->completed_at)->not->toBeNull();

    $this->postJson('/api/v1/_idem/big', [], $key)
        ->assertOk()
        ->assertJsonPath('message', 'Sudah diproses.')
        ->assertHeader('Idempotent-Replayed', 'true');

    expect($this->calls)->toBe(1);
});

test('keys are isolated per user', function () {
    $headers = idem('shared-key-1234567890');
    $this->postJson('/api/v1/_idem/ok', [], $headers)->assertJsonPath('n', 1);

    Sanctum::actingAs(User::factory()->create());
    $this->postJson('/api/v1/_idem/ok', [], $headers)->assertCreated()->assertJsonPath('n', 2);

    expect($this->calls)->toBe(2)->and(DB::table('api_idempotency_keys')->count())->toBe(2);
});

test('a malformed key is a 422 idempotency_key_invalid', function () {
    foreach (['short', str_repeat('a', 65), 'has spaces in the key!!'] as $bad) {
        $this->postJson('/api/v1/_idem/ok', [], idem($bad))
            ->assertStatus(422)
            ->assertJsonPath('reason', 'idempotency_key_invalid');
    }

    expect($this->calls)->toBe(0);
});

test('api:prune-idempotency removes keys older than 72 hours', function () {
    $row = fn (string $key, $createdAt): array => [
        'id' => (string) Str::ulid(),
        'user_id' => $this->user->id,
        'key' => $key,
        'method' => 'POST',
        'path_hash' => str_repeat('a', 64),
        'created_at' => $createdAt,
    ];

    DB::table('api_idempotency_keys')->insert([
        $row('old-key-0123456789ab', now()->subHours(73)),
        $row('edge-key-0123456789a', now()->subHours(71)),
        $row('new-key-0123456789ab', now()),
    ]);

    Artisan::call('api:prune-idempotency');

    expect(DB::table('api_idempotency_keys')->pluck('key')->sort()->values()->all())
        ->toBe(['edge-key-0123456789a', 'new-key-0123456789ab']);
});

test('the prune command is scheduled daily', function () {
    $events = collect(app(Schedule::class)->events());

    expect($events->contains(fn ($event) => str_contains((string) $event->command, 'api:prune-idempotency')))->toBeTrue();
});
