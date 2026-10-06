<?php

use App\Domain\Chat\Actions\OpenDirectConversation;
use App\Domain\Chat\Actions\PostMessage;
use App\Domain\Organization\Enums\Role;
use App\Events\Chat\MessagePosted;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\Message;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config(['features.chat' => true]);
    $this->dimas = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->sari = User::factory()->create(['name' => 'Sari Wulandari']);
    $this->dm = app(OpenDirectConversation::class)->handle($this->dimas, [$this->sari->id]);
});

it('renders the chat index with channels, unread counts and people', function () {
    $this->travel(-1)->minutes();
    app(PostMessage::class)->handle($this->dm, $this->sari, richDoc('Halo Pak'));
    $this->travelBack();
    Channel::factory()->publicChannel()->create(['name' => 'umum']);

    $this->actingAs($this->dimas)->get('/obrolan')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('chat/index')
            ->where('chat.viewer_id', $this->dimas->id)
            ->has('chat.channels', 2)
            ->where('chat.channels', fn ($channels) => collect($channels)->firstWhere('id', $this->dm->id)['unread_count'] === 1)
            ->where('chat.current', null)
            ->has('chat.people'));

    $this->actingAs($this->dimas)->get('/')->assertRedirect();
    expect($this->actingAs($this->dimas)->get('/menu')->inertiaProps('chat.unread'))->toBe(1);
});

it('opens a channel, marks it read and sends the timeline', function () {
    $message = app(PostMessage::class)->handle($this->dm, $this->sari, richDoc('Laporan sudah saya kirim'));

    $this->actingAs($this->dimas)->get('/obrolan/'.$this->dm->id)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('chat/show')
            ->where('chat.current.channel_id', $this->dm->id)
            ->where('chat.current.messages.0.id', $message->id)
            ->where('chat.current.messages.0.body_text', 'Laporan sudah saya kirim')
            ->where('chat.current.can_post', true)
            ->where('chat.current.has_more', false));

    expect(ChannelMember::query()->where('channel_id', $this->dm->id)->where('user_id', $this->dimas->id)->value('last_read_message_id'))->toBe($message->id);
});

it('hides other people\'s DMs behind 404, even from Super Admin', function () {
    $admin = User::factory()->withRole(Role::SuperAdmin)->create();

    $this->actingAs($admin)->get('/obrolan/'.$this->dm->id)->assertNotFound();
    $this->actingAs($admin)->postJson('/obrolan/'.$this->dm->id.'/pesan', ['body' => richDoc('Halo')])->assertNotFound();
});

it('sends, edits, reacts to and deletes a message through JSON', function () {
    Event::fake([MessagePosted::class]);

    $sent = $this->actingAs($this->dimas)->postJson('/obrolan/'.$this->dm->id.'/pesan', ['body' => richDoc('Rapat ', ['@', $this->sari])])
        ->assertCreated()
        ->assertJsonPath('message.body_text', 'Rapat @Sari Wulandari')
        ->json('message.id');

    $this->actingAs($this->dimas)->patchJson('/obrolan/pesan/'.$sent, ['body' => richDoc('Rapat jam 3')])
        ->assertOk()->assertJsonPath('message.body_text', 'Rapat jam 3');
    $this->actingAs($this->sari)->patchJson('/obrolan/pesan/'.$sent, ['body' => richDoc('Bukan pesan saya')])->assertForbidden();

    $this->actingAs($this->sari)->postJson('/obrolan/pesan/'.$sent.'/reaksi', ['emoji' => '👍'])
        ->assertOk()->assertJsonPath('message.reactions.0', ['emoji' => '👍', 'user_ids' => [$this->sari->id]]);
    $this->actingAs($this->sari)->postJson('/obrolan/pesan/'.$sent.'/reaksi', ['emoji' => '🤡'])->assertUnprocessable();

    $this->actingAs($this->dimas)->deleteJson('/obrolan/pesan/'.$sent)
        ->assertOk()->assertJsonPath('message.body', null)->assertJsonPath('message.reactions', []);
    $this->actingAs($this->dimas)->getJson('/obrolan/pesan/'.$sent)->assertOk()->assertJsonPath('message.deleted_at', fn ($value) => $value !== null);

    Event::assertDispatched(MessagePosted::class);
});

it('rejects an empty message and a reply to another channel', function () {
    $other = Channel::factory()->publicChannel()->create();
    $root = Message::factory()->in($other)->by($this->dimas)->create();

    $this->actingAs($this->dimas)->postJson('/obrolan/'.$this->dm->id.'/pesan', ['body' => null])->assertUnprocessable();
    $this->actingAs($this->dimas)->postJson('/obrolan/'.$this->dm->id.'/pesan', ['body' => richDoc('Balas'), 'parent_id' => $root->id])->assertStatus(422);
});

it('creates channels and opens DMs', function () {
    $id = $this->actingAs($this->dimas)->postJson('/obrolan', ['name' => 'Tim Konten', 'private' => true, 'member_ids' => [$this->sari->id]])
        ->assertCreated()->json('id');

    expect(Channel::query()->find($id)?->name)->toBe('tim-konten');

    $this->actingAs($this->sari)->postJson('/obrolan/langsung', ['user_ids' => [$this->dimas->id]])
        ->assertOk()->assertJsonPath('id', $this->dm->id);
    $this->actingAs($this->sari)->postJson('/obrolan/langsung', ['user_ids' => []])->assertUnprocessable();
});

it('pages older messages and mutes', function () {
    $this->actingAs($this->dimas)->getJson('/obrolan/'.$this->dm->id.'/pesan?sebelum=01ZZZZZZZZZZZZZZZZZZZZZZZZ')
        ->assertOk()->assertJsonPath('has_more', false);

    $this->actingAs($this->dimas)->putJson('/obrolan/'.$this->dm->id.'/bisu', ['muted' => true])->assertOk();

    expect(ChannelMember::query()->where('channel_id', $this->dm->id)->where('user_id', $this->dimas->id)->value('muted'))->toBeTrue();
});

it('answers 404 everywhere while the chat flag is off', function () {
    config(['features.chat' => false]);

    $this->actingAs($this->dimas)->get('/obrolan')->assertNotFound();
    $this->actingAs($this->dimas)->get('/obrolan/'.$this->dm->id)->assertNotFound();
    expect($this->actingAs($this->dimas)->get('/menu')->inertiaProps('chat'))->toBeNull();
});

it('sends guests to login', function () {
    $this->get('/obrolan')->assertRedirect(route('login'));
});

it('authorizes the chat broadcast channels like the policy', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    Broadcast::forgetDrivers();
    require base_path('routes/channels.php');

    $auth = fn (User $user, string $channel): TestResponse => $this->actingAs($user)->postJson('/broadcasting/auth', [
        'channel_name' => $channel,
        'socket_id' => '1234.5678',
    ]);

    $auth($this->sari, 'private-chat.'.$this->dm->id)->assertOk();
    expect($auth(User::factory()->withRole(Role::SuperAdmin)->create(), 'private-chat.'.$this->dm->id)->status())->toBeIn([403, 404]);
    $auth($this->sari, 'presence-chat-online.'.$this->sari->company_id)->assertOk()->assertJsonStructure(['auth', 'channel_data']);
});
