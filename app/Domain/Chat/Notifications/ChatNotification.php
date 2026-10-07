<?php

namespace App\Domain\Chat\Notifications;

use App\Domain\Chat\Services\ChannelTitle;
use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Tasks\Services\RichText;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use App\Policies\ChannelPolicy;

/**
 * Shared parts of the Obrolan notifications: subject = the channel (one
 * unread "pesan baru" per channel, resolved when the channel is read), link =
 * /obrolan/{id}#pesan-{message}.
 */
abstract class ChatNotification extends BaseNotification
{
    public function __construct(
        public readonly Channel $channel,
        public readonly Message $message,
        public readonly User $actor,
    ) {}

    /**
     * Dropped when the message was deleted or the recipient lost access while
     * the notification waited in the queue.
     */
    protected function stillVisibleTo(User $notifiable): bool
    {
        $message = Message::query()->find($this->message->id);
        $channel = Channel::query()->find($this->channel->id);

        return $message !== null && $channel !== null && app(ChannelPolicy::class)->canView($notifiable, $channel);
    }

    protected function title(User $notifiable): string
    {
        return ChannelTitle::for($this->channel, $notifiable);
    }

    protected function excerpt(): string
    {
        $text = RichText::excerpt($this->message->body, 200);

        return $text !== '' ? $text : 'Mengirim lampiran';
    }

    protected function subject(User $notifiable): NotificationSubject
    {
        return NotificationSubject::fromModel($this->channel, null, $this->title($notifiable));
    }

    protected function actorData(): NotificationActor
    {
        return NotificationActor::fromUser($this->actor);
    }

    protected function url(): string
    {
        return '/obrolan/'.$this->channel->id.'#pesan-'.$this->message->id;
    }

    /**
     * @return array<string, mixed>
     */
    protected function meta(): array
    {
        return [
            'quote' => true,
            'open_label' => 'Buka obrolan',
            'message_id' => $this->message->id,
            'channel_id' => $this->channel->id,
        ];
    }
}
