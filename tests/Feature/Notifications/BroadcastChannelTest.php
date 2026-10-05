<?php

use App\Models\User;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    // The null broadcaster authorizes everything; use the Pusher-compatible
    // Reverb driver so routes/channels.php callbacks really run.
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);

    // Channels were registered on the boot-time (null) broadcaster; register them on this one.
    require base_path('routes/channels.php');
});

function authorizeChannel(User $user, string $channel): TestResponse
{
    return test()->actingAs($user)->post('/broadcasting/auth', [
        'channel_name' => $channel,
        'socket_id' => '1234.5678',
    ]);
}

it('authorizes a user on their own notification channel', function () {
    $user = User::factory()->create();

    authorizeChannel($user, "private-App.Models.User.{$user->id}")
        ->assertOk()
        ->assertJsonStructure(['auth']);
});

it('rejects another user\'s notification channel', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    authorizeChannel($user, "private-App.Models.User.{$other->id}")->assertForbidden();
});

it('compares ULIDs as strings (no integer casting)', function () {
    // Both start with "01" + letters: (int) would turn each into 1.
    $user = User::factory()->create(['id' => '01JABCDEFGHJKMNPQRSTVWXYZ0']);

    authorizeChannel($user, 'private-App.Models.User.01JZZZZZZZZZZZZZZZZZZZZZZZ')->assertForbidden();
    authorizeChannel($user, 'private-App.Models.User.01JABCDEFGHJKMNPQRSTVWXYZ0')->assertOk();
});

it('rejects guests', function () {
    $user = User::factory()->create();

    $this->post('/broadcasting/auth', [
        'channel_name' => "private-App.Models.User.{$user->id}",
        'socket_id' => '1234.5678',
    ])->assertForbidden();
});
