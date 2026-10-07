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
 * Obrolan events on the private channel `chat.{id}` (audience = ChannelPolicy::view,
 * routes/channels.php). Thin payload (ids only, never the text): someone who
 * lost access may still be subscribed, so clients refetch through the
 * authorized JSON endpoints. Dispatched after commit on the `realtime` queue.
 */
abstract class ChatBroadcastEvent implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, string|null>  $ids
     */
    public function __construct(public Channel $channel, public array $ids = []) {}

    public function broadcastQueue(): string
    {
        return 'realtime';
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('chat.'.$this->channel->id)];
    }

    /**
     * @return array<string, string|null>
     */
    public function broadcastWith(): array
    {
        return ['channel_id' => $this->channel->id, ...$this->ids];
    }
}
