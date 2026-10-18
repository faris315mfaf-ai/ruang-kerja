<?php

use App\Models\User;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Fase 1 multi-perusahaan — the 8 channels of routes/channels.php refuse every
 * employee of company A for company B's user, workspace, task, attendance
 * feeds, chat, presence and meeting room, while B's own people are let in.
 */

beforeEach(function () {
    // Built on the null broadcaster: building the worlds broadcasts events.
    $this->home = homeWorld();
    $this->foreign = foreignWorld();

    // The null broadcaster authorizes everything; use the Pusher-compatible
    // Reverb driver so the routes/channels.php callbacks really run.
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);

    require base_path('routes/channels.php');
});

/**
 * B's channels with one B person allowed on each (positive control).
 *
 * @return array<string, User>
 */
function foreignChannels(object $foreign): array
{
    return [
        "private-App.Models.User.{$foreign->anggota->id}" => $foreign->anggota,
        "private-workspace.{$foreign->teamWorkspace->id}" => $foreign->kadiv,
        "presence-workspace.{$foreign->teamWorkspace->id}" => $foreign->kadiv,
        "private-task.{$foreign->task->id}" => $foreign->kadiv,
        "presence-task.{$foreign->task->id}" => $foreign->kadiv,
        "private-company.{$foreign->company->id}.attendance" => $foreign->hr,
        "private-division.{$foreign->division->id}.attendance" => $foreign->hr,
        "private-chat.{$foreign->channel->id}" => $foreign->kadiv,
        "presence-chat-online.{$foreign->company->id}" => $foreign->anggota,
        "private-meeting.{$foreign->meeting->id}" => $foreign->kadiv,
    ];
}

test('company A employees cannot subscribe to company B\'s channels', function (string $role) {
    $actor = $this->home->{$role};

    foreach (array_keys(foreignChannels($this->foreign)) as $channel) {
        $status = $this->actingAs($actor)->post('/broadcasting/auth', ['channel_name' => $channel, 'socket_id' => '1234.5678'])->getStatusCode();

        expect($status)->toBeIn([403, 404], "{$role} → {$channel}");
    }
})->with(['superAdmin', 'hr', 'direksi', 'kadiv', 'anggota']);

test('company B\'s own people can subscribe (positive control)', function () {
    foreach (foreignChannels($this->foreign) as $channel => $owner) {
        $this->actingAs($owner)
            ->post('/broadcasting/auth', ['channel_name' => $channel, 'socket_id' => '1234.5678'])
            ->assertOk();
    }
});
