<?php

use App\Domain\Notifications\Enums\NotificationType;
use App\Models\InboxNotification;
use App\Models\User;
use Database\Seeders\RoleSeeder;

/*
| API v1 — Inbox feed for the mobile app (Tahap 1): the caller's own active
| notifications through the same visibleTo scope and presenter as the web
| Inbox (archived rows and other people's Inbox never appear), ?belum-dibaca
| narrows to the unread ones, and "baca" marks one notification read.
*/

const HASH_PONSEL = 'abababababababababababababababababababababababababababababababab'; // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->rizky = User::factory()->create(['name' => 'Rizky Aditya', 'email' => 'rizky@kantor.test']);
    $this->sari = User::factory()->create(['name' => 'Sari Wulandari']);

    $this->mention = InboxNotification::factory()
        ->recipient($this->rizky)
        ->ofType(NotificationType::Mention)
        ->withData(['title' => 'Anda disebut', 'body' => 'Rizky disebut di TMS-1', 'url' => '/w/TMS/tasks/1'])
        ->create(['read_at' => null, 'created_at' => now()->subMinutes(10)]);
    $this->terbaca = InboxNotification::factory()
        ->recipient($this->rizky)
        ->read()
        ->create(['read_at' => now()->subMinutes(20), 'created_at' => now()->subMinutes(20)]);
    InboxNotification::factory()->recipient($this->rizky)->archived()->create();
    $this->milikSari = InboxNotification::factory()->recipient($this->sari)->create();
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukInbox(string $email): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

test('the feed lists only my active notifications with the web presenter fields', function () {
    $token = masukInbox('rizky@kantor.test');

    $response = test()->withToken($token)->getJson('/api/v1/inbox');

    $response->assertOk()
        ->assertJsonPath('meta', [
            'current_page' => 1, 'from' => 1, 'last_page' => 1, 'per_page' => 20, 'to' => 2, 'total' => 2,
        ])
        ->assertJsonPath('unread', 1)
        ->assertJsonPath('items.0.title', 'Anda disebut')
        ->assertJsonPath('items.0.body', 'Rizky disebut di TMS-1')
        ->assertJsonPath('items.0.type', NotificationType::Mention->value)
        ->assertJsonPath('items.0.url', '/w/TMS/tasks/1')
        ->assertJsonPath('items.0.read_at', null)
        ->assertJsonPath('items.1.read_at', fn (string $read) => $read !== null);

    expect(collect($response->json('items'))->pluck('id'))
        ->toContain($this->mention->id, $this->terbaca->id)
        ->not->toContain($this->milikSari->id);
});

test('belum-dibaca=1 narrows the feed to the unread ones', function () {
    $token = masukInbox('rizky@kantor.test');

    $response = test()->withToken($token)->getJson('/api/v1/inbox?belum-dibaca=1');

    $response->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('items.0.id', $this->mention->id)
        ->assertJsonPath('unread', 1);

    expect($response->json('items.0.id'))->not->toBe($this->terbaca->id);
});

test('the feed paginates 20 per page', function () {
    $token = masukInbox('rizky@kantor.test');

    InboxNotification::factory()->recipient($this->rizky)->count(21)->create();

    test()->withToken($token)->getJson('/api/v1/inbox')
        ->assertOk()
        ->assertJsonPath('meta.total', 23)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonCount(20, 'items');

    test()->withToken($token)->getJson('/api/v1/inbox?page=2')
        ->assertOk()
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonCount(3, 'items');
});

test('baca marks one notification read and answers the unread count', function () {
    $token = masukInbox('rizky@kantor.test');

    test()->withToken($token)->postJson("/api/v1/inbox/{$this->mention->id}/baca")
        ->assertOk()
        ->assertJsonPath('unread', 0);

    expect($this->mention->fresh()->read_at)->not->toBeNull();

    // Idempotent: marking it again keeps 200 and does not double-count.
    test()->withToken($token)->postJson("/api/v1/inbox/{$this->mention->id}/baca")
        ->assertOk()
        ->assertJsonPath('unread', 0);
});

test("someone else's notification answers 404 and stays unread", function () {
    $token = masukInbox('rizky@kantor.test');

    test()->withToken($token)->postJson("/api/v1/inbox/{$this->milikSari->id}/baca")
        ->assertNotFound();

    expect($this->milikSari->fresh()->read_at)->toBeNull();
});

test('inbox endpoints reject requests without a token', function () {
    test()->getJson('/api/v1/inbox')->assertUnauthorized();
    test()->postJson("/api/v1/inbox/{$this->mention->id}/baca")->assertUnauthorized();
});
