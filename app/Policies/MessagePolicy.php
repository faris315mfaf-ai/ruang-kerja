<?php

namespace App\Policies;

use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Messages follow their channel (ChannelPolicy): invisible → 404. Editing is
 * for the author; deleting for the author or a moderator of the channel
 * (owner/admin, or the admins of a workspace channel's workspace).
 */
class MessagePolicy
{
    public function __construct(private readonly ChannelPolicy $channels) {}

    public function view(User $user, Message $message): Response
    {
        return $this->channels->view($user, $message->channel);
    }

    public function create(User $user, Channel $channel): Response
    {
        return $this->channels->post($user, $channel);
    }

    public function update(User $user, Message $message): Response
    {
        return $this->guard($user, $message, fn (): bool => $message->user_id === $user->id, 'Hanya pengirim yang dapat mengubah pesan ini.');
    }

    public function delete(User $user, Message $message): Response
    {
        return $this->guard(
            $user,
            $message,
            fn (): bool => $message->user_id === $user->id || $this->channels->canManage($user, $message->channel),
            'Hanya pengirim atau admin obrolan yang dapat menghapus pesan ini.',
        );
    }

    public function react(User $user, Message $message): Response
    {
        return $this->guard($user, $message, fn (): bool => true, '');
    }

    /**
     * @param  callable(): bool  $allowed
     */
    private function guard(User $user, Message $message, callable $allowed, string $denied): Response
    {
        if (! $this->channels->canView($user, $message->channel) || $message->trashed()) {
            return Response::denyAsNotFound();
        }

        $post = $this->channels->post($user, $message->channel);

        if ($post->denied()) {
            return $post;
        }

        return $allowed() ? Response::allow() : Response::deny($denied);
    }
}
