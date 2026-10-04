<?php

namespace App\Domain\Requests\Notifications;

use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Base of request notifications: database + email, Indonesian, queued after commit.
 *
 * TODO(sprint-8): extend App\Domain\Notifications\BaseNotification once the
 * notification infrastructure is merged (preferences, quiet hours, Inbox payload).
 */
abstract class RequestNotification extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    public function __construct(public readonly EmployeeRequest $request) {}

    /**
     * Notification kind, e.g. `request.submitted`.
     */
    abstract public function kind(): string;

    abstract public function title(User $notifiable): string;

    abstract public function body(User $notifiable): ?string;

    abstract public function url(User $notifiable): string;

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function databaseType(object $notifiable): string
    {
        return $this->kind();
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        if (! $notifiable instanceof User) {
            return [];
        }

        return [
            'type' => $this->kind(),
            'title' => $this->title($notifiable),
            'body' => $this->body($notifiable),
            'url' => $this->url($notifiable),
            'subject' => [
                'type' => 'request',
                'id' => $this->request->id,
                'code' => $this->request->number,
                'title' => $this->request->leaveType->name,
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $user = $notifiable instanceof User ? $notifiable : null;
        $title = $user !== null ? $this->title($user) : $this->request->leaveType->name;
        $body = $user !== null ? $this->body($user) : null;

        $mail = (new MailMessage)
            ->subject($title)
            ->greeting('Halo'.($user !== null ? ', '.$user->name : '').'!')
            ->line($title);

        if ($body !== null && $body !== '') {
            $mail->line($body);
        }

        return $mail
            ->action('Buka di RuangKerja', url($user !== null ? $this->url($user) : '/pengajuan'))
            ->salutation('Salam, RuangKerja');
    }
}
