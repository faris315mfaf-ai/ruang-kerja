<?php

namespace App\Domain\Notifications;

use App\Domain\Notifications\Channels\InAppChannel;
use App\Domain\Notifications\Channels\WhatsAppChannel;
use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\WhatsAppMessage;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationPreferenceResolver;
use App\Domain\Notifications\Services\QuietHours;
use App\Models\NotificationSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Base class for every RuangKerja notification.
 *
 * Subclasses implement type() and payload(); everything else is uniform:
 * - via() honours notification_preferences (defaults from config/notifications.php),
 *   locked channels, the WhatsApp feature flag, "hold while on leave" and
 *   quiet hours (email delayed, see withDelay()).
 * - In-app = InAppChannel (database) + broadcast on the user's private channel.
 * - Queued after the surrounding DB transaction commits.
 *
 * See docs/sprints/sprint-8/HOW-TO-NOTIFY.md.
 */
abstract class BaseNotification extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    abstract public function type(): NotificationType;

    /**
     * Content shown in the Inbox, toast, email and WhatsApp.
     */
    abstract public function payload(User $notifiable): NotificationPayload;

    /**
     * Whether this notification appears under "Perlu tindakan" until resolved.
     */
    public function requiresAction(): bool
    {
        return $this->type()->requiresAction();
    }

    /**
     * @return list<string>
     */
    final public function via(object $notifiable): array
    {
        if (! $notifiable instanceof User) {
            return [];
        }

        $channels = app(NotificationPreferenceResolver::class)->enabledChannels($notifiable, $this->type()->event());
        $held = $this->isHeld($notifiable);
        $via = [];

        foreach ($channels as $channel) {
            // While held (on leave), only the Inbox record is kept: no toast, email or WhatsApp.
            if ($channel === NotificationChannel::InApp) {
                $via[] = InAppChannel::class;

                if (! $held) {
                    $via[] = 'broadcast';
                }
            } elseif (! $held) {
                $via[] = $channel === NotificationChannel::Email ? 'mail' : WhatsAppChannel::class;
            }
        }

        return $via;
    }

    /**
     * Quiet hours: delay email/WhatsApp until working hours (office timezone).
     */
    public function withDelay(object $notifiable, string $channel): ?DateTimeInterface
    {
        if (! $notifiable instanceof User || ! in_array($channel, ['mail', WhatsAppChannel::class], true)) {
            return null;
        }

        if (! NotificationSetting::for($notifiable)->quiet_hours) {
            return null;
        }

        $quietHours = app(QuietHours::class);
        $now = CarbonImmutable::now();

        return $quietHours->isQuiet($now) ? $quietHours->nextAllowed($now) : null;
    }

    public function databaseType(object $notifiable): string
    {
        return $this->type()->value;
    }

    public function broadcastType(): string
    {
        return $this->type()->value;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return $notifiable instanceof User
            ? $this->payload($notifiable)->toArray($this->type())
            : [];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return $this->toArray($notifiable);
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        $type = $this->type();

        return new BroadcastMessage([
            ...$this->toArray($notifiable),
            'category' => $type->category()->value,
            'icon' => $type->icon(),
            'tone' => $type->tone(),
            'action_required' => $this->requiresAction(),
            'created_at' => CarbonImmutable::now()->toIso8601String(),
        ]);
    }

    public function toMail(object $notifiable): MailMessage
    {
        $user = $notifiable instanceof User ? $notifiable : null;
        $payload = $user ? $this->payload($user) : new NotificationPayload($this->type()->label());

        return (new MailMessage)
            ->subject($payload->title)
            ->view(['html' => 'mail.notification', 'text' => 'mail.notification-text'], [
                'user' => $user,
                'payload' => $payload,
                'typeLabel' => $this->type()->label(),
                'actionUrl' => url($payload->url ?? '/inbox'),
                'actionLabel' => $this->stringMeta($payload, 'open_label') ?? 'Buka di RuangKerja',
                'settingsUrl' => url('/pengaturan/notifikasi'),
            ]);
    }

    public function toWhatsApp(object $notifiable): WhatsAppMessage
    {
        $payload = $notifiable instanceof User
            ? $this->payload($notifiable)
            : new NotificationPayload($this->type()->label());

        $text = trim($payload->title."\n".($payload->body ?? ''));

        return new WhatsAppMessage($text, $payload->url !== null ? url($payload->url) : null);
    }

    private function isHeld(User $user): bool
    {
        return NotificationSetting::for($user)->pause_while_on_leave
            && app(UserAvailability::class)->isOnLeave($user, CarbonImmutable::now());
    }

    private function stringMeta(NotificationPayload $payload, string $key): ?string
    {
        $value = $payload->meta[$key] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }
}
