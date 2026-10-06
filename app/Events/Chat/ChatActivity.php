<?php

namespace App\Events\Chat;

use App\Models\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * "Something new in channel X" for the members' own user channels
 * (`App.Models.User.{id}`): updates the sidebar unread badges and the Dock
 * tile without subscribing to every channel. Thin: channel id only.
 */
final class ChatActivity implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  list<string>  $userIds
     */
    public function __construct(public Channel $channel, public array $userIds) {}

    public function broadcastQueue(): string
    {
        return 'realtime';
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return array_map(fn (string $id): PrivateChannel => new PrivateChannel('App.Models.User.'.$id), $this->userIds);
    }

    public function broadcastAs(): string
    {
        return 'chat.activity';
    }

    /**
     * @return array<string, string>
     */
    public function broadcastWith(): array
    {
        return ['channel_id' => $this->channel->id];
    }

    public function broadcastWhen(): bool
    {
        return $this->userIds !== [];
    }
}
