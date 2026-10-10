<?php

use App\Domain\Chat\Actions\OpenDirectConversation;
use App\Domain\Chat\Notifications\DirectMessageNotification;
use App\Events\Chat\MessagePosted;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — obrolan untuk ponsel: daftar kanal ChatInbox web (belum dibaca,
| pratinjau terakhir), timeline 30 pesan dengan ?sebelum= untuk scroll balik,
| dan kirim pesan teks polos lewat PostMessage web — broadcast Reverb untuk
| pengguna web tetap jalan, aplikasi v1 memakai polling. Di balik flag
| features.chat seperti web; kanal privat/DM orang lain → 404.
*/

if (! defined('HASH_PONSEL')) {
    define('HASH_PONSEL', str_repeat('ab', 32));
} // 64 hex (SHA-256)

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.chat' => true]);
    Notification::fake();

    $this->dimas = User::factory()->create(['name' => 'Dimas Pratama', 'email' => 'dimas@kantor.test']);
    $this->sari = User::factory()->create(['name' => 'Sari Wulandari']);
    $this->outsider = User::factory()->create(['name' => 'Orang Luar']);

    $this->dm = app(OpenDirectConversation::class)->handle($this->dimas, [$this->sari->id]);
    $this->publik = Channel::factory()->publicChannel()->create(['name' => 'umum']);
    $this->privat = Channel::factory()->privateChannel()->withMembers([$this->dimas])->create(['name' => 'rapat-direksi']);
});

/**
 * Signs `email` in through the real endpoint and returns the issued token.
 */
function masukObrolan(string $email): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * Calls as a (different) token: drop the cached guards first (see
 * AuthApiTest::sebagaiToken).
 */
function sebagaiTokenObrolan(string $token): TestCase
{
    app(Factory::class)->forgetGuards();

    return test()->withToken($token);
}

test('the channel list carries unread counts and hides foreign DMs', function () {
    Message::factory()->in($this->dm)->by($this->sari)->create(['body_text' => 'Laporan sudah saya kirim']);
    $token = masukObrolan('dimas@kantor.test');

    $response = $this->withToken($token)->getJson('/api/v1/obrolan/kanal');

    $response->assertOk();

    $channels = collect($response->json('channels'));
    $dm = $channels->firstWhere('id', $this->dm->id);
    $publik = $channels->firstWhere('id', $this->publik->id);

    expect($dm)->not->toBeNull()
        ->and($dm['type'])->toBe('dm')
        ->and($dm['unread_count'])->toBe(1)
        ->and($dm['last_message']['body_text'])->toBe('Laporan sudah saya kirim')
        ->and($dm['can_post'])->toBeTrue()
        ->and($publik)->not->toBeNull()
        // Kanal privat milik dimas memang terlihat untuknya.
        ->and($channels->pluck('id'))->toContain($this->privat->id);

    // Kanal privat orang lain tidak pernah muncul bagi sari.
    $sari = masukObrolan($this->sari->email);
    $daftarSari = collect(sebagaiTokenObrolan($sari)->getJson('/api/v1/obrolan/kanal')->json('channels'));

    expect($daftarSari->pluck('id'))->not->toContain($this->privat->id)
        ->and($daftarSari->pluck('id'))->toContain($this->dm->id)
        ->and($daftarSari->pluck('id'))->toContain($this->publik->id);
});

test('the timeline pages 30 messages and scrolls back with sebelum', function () {
    Message::factory()->in($this->dm)->by($this->sari)->count(35)->create();
    $token = masukObrolan('dimas@kantor.test');

    $page1 = $this->withToken($token)->getJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan");

    $page1->assertOk()
        ->assertJsonPath('has_more', true)
        ->assertJsonCount(30, 'messages');

    // Terbaru dulu di antara root (halaman diurutkan tua → baru).
    $newest = Message::query()->where('channel_id', $this->dm->id)->orderByDesc('id')->first();
    expect($page1->json('messages.29.id'))->toBe($newest->id)
        ->and($page1->json('messages.0.body_text'))->toBeString();

    // Scroll balik: pesan sebelum yang tertua di halaman 1.
    $oldestShown = $page1->json('messages.0.id');

    $page2 = $this->withToken($token)->getJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan?sebelum={$oldestShown}");

    $page2->assertOk()
        ->assertJsonPath('has_more', false)
        ->assertJsonCount(5, 'messages');

    $shown = collect($page2->json('messages'))->pluck('id');

    expect($shown)->not->toContain($oldestShown);

    // sebelum tak dikenal → halaman kosong, bukan galat.
    $this->withToken($token)->getJson('/api/v1/obrolan/kanal/'.$this->dm->id.'/pesan?sebelum=01ZZZZZZZZZZZZZZZZZZZZZZZZ')
        ->assertOk()
        ->assertJsonPath('has_more', false)
        ->assertJsonCount(0, 'messages');
});

test('a plain-text message is stored like the web and notifies the DM partner', function () {
    Event::fake([MessagePosted::class]);
    $token = masukObrolan('dimas@kantor.test');

    $this->withToken($token)->postJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan", [
        'body' => 'Rapat jam 3 ya.',
    ])->assertCreated()
        ->assertJsonPath('message.body_text', 'Rapat jam 3 ya.')
        ->assertJsonPath('message.channel_id', $this->dm->id)
        ->assertJsonPath('message.body.type', 'doc');

    // Broadcast Reverb untuk pengguna web tetap dikirim.
    Event::assertDispatched(MessagePosted::class);
    Notification::assertSentTo($this->sari, DirectMessageNotification::class);

    // Pesan kosong ditolak.
    $this->withToken($token)->postJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan", ['body' => '   '])
        ->assertUnprocessable()
        ->assertJsonPath('errors.body.0', 'Pesan tidak boleh kosong.');
});

test('non-members get 404 on private channels and foreign DMs', function () {
    $token = masukObrolan($this->sari->email);

    // Kanal privat milik dimas → 404 (baca maupun kirim).
    sebagaiTokenObrolan($token)->getJson("/api/v1/obrolan/kanal/{$this->privat->id}/pesan")->assertNotFound();
    sebagaiTokenObrolan($token)->postJson("/api/v1/obrolan/kanal/{$this->privat->id}/pesan", ['body' => 'Halo'])->assertNotFound();

    // DM orang lain (dimas–sari adalah milik keduanya; pakai orang luar).
    $outsider = masukObrolan($this->outsider->email);

    sebagaiTokenObrolan($outsider)->getJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan")->assertNotFound();
    sebagaiTokenObrolan($outsider)->postJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan", ['body' => 'Menyusup'])->assertNotFound();

    expect(Message::query()->where('channel_id', $this->dm->id)->count())->toBe(0)
        ->and(Message::query()->where('channel_id', $this->privat->id)->count())->toBe(0);
});

test('the chat flag off answers 404 like the web', function () {
    config(['features.chat' => false]);

    $token = masukObrolan('dimas@kantor.test');

    $this->withToken($token)->getJson('/api/v1/obrolan/kanal')->assertNotFound();
    $this->withToken($token)->getJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan")->assertNotFound();
    $this->withToken($token)->postJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan", ['body' => 'Halo'])->assertNotFound();
});

test('chat endpoints reject requests without a token', function () {
    $this->getJson('/api/v1/obrolan/kanal')->assertUnauthorized();
    $this->getJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan")->assertUnauthorized();
    $this->postJson("/api/v1/obrolan/kanal/{$this->dm->id}/pesan", ['body' => 'Halo'])->assertUnauthorized();
});

it('includes the author name on every message and clears unread via the read endpoint', function () {
    $tokenDimas = masukObrolan('dimas@kantor.test');

    sebagaiTokenObrolan($tokenDimas)
        ->postJson('/api/v1/obrolan/kanal/'.$this->dm->id.'/pesan', ['body' => 'Halo dengan nama'])
        ->assertCreated();

    $tokenSari = masukObrolan($this->sari->email);
    sebagaiTokenObrolan($tokenSari)
        ->getJson('/api/v1/obrolan/kanal/'.$this->dm->id.'/pesan')
        ->assertOk()
        ->assertJsonPath('messages.0.penulis.nama', 'Dimas Pratama');

    sebagaiTokenObrolan($tokenSari)
        ->postJson('/api/v1/obrolan/kanal/'.$this->dm->id.'/dibaca')
        ->assertOk()
        ->assertJsonPath('dibaca', true);
});
