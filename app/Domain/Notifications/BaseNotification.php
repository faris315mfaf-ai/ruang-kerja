<?php

namespace App\Domain\Notifications;

use App\Domain\Devices\Models\Device;
use App\Domain\Notifications\Channels\FcmChannel;
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
 * - In-app = InAppChannel (database) + broadcast on the user's private channel
 *   + FcmChannel (Android push, only for users with a registered push token;
 *   follows the In-app preference and quiet hours like email).
 * - Email/WhatsApp render externalPayload() (defaults to payload()), so a module
 *   can keep sensitive free text in-app only.
 * - Queued after the surrounding DB transaction commits.
 * - Checked again right before each channel delivers (shouldSend()): a queued or
 *   delayed (quiet hours) notification is dropped when the recipient was
 *   deactivated or can no longer see the subject (stillVisibleTo()).
 *
 * See docs/sprints/sprint-8/HOW-TO-NOTIFY.md.
 */
abstract class BaseNotification extends Notification implements ShouldQueueAfterCommit
{
    use Queueable;

    /**
     * The subject was hard-deleted while queued → drop instead of failing.
     */
    public bool $deleteWhenMissingModels = true;

    abstract public function type(): NotificationType;

    /**
     * Content shown in the Inbox, toast, email and WhatsApp.
     */
    abstract public function payload(User $notifiable): NotificationPayload;

    /**
     * Content for channels that leave the app (email, WhatsApp). Defaults to
     * payload(); override to drop sensitive free text (notes, health details)
     * that should only be read in-app behind authorization.
     */
    public function externalPayload(User $notifiable): NotificationPayload
    {
        return $this->payload($notifiable);
    }

    /**
     * Whether this notification appears under "Perlu tindakan" until resolved.
     */
    public function requiresAction(): bool
    {
        return $this->type()->requiresAction();
    }

    /**
     * Follow-up that only rings the phone: no Inbox row, toast, email or
     * WhatsApp (e.g. the next messages of a conversation whose first "Pesan
     * baru" is still unread). Still follows the In-app preference.
     */
    public function pushOnly(): bool
    {
        return false;
    }

    /**
     * FCM `android.notification.tag`: a push with the same tag replaces the
     * one in the notification shade. Null = this notification's own id.
     */
    public function pushTag(): ?string
    {
        return null;
    }

    /**
     * `data.group_key` of the push (shade grouping hint for the app). Null =
     * the Android channel id of the type.
     */
    public function pushGroupKey(): ?string
    {
        return null;
    }

    /**
     * `data.notification_id` of the push, i.e. the Inbox row opened/marked
     * read on tap. Null = this notification's own id; push-only follow-ups
     * point at the Inbox row they belong to.
     */
    public function pushInboxId(): ?string
    {
        return null;
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

        if ($this->pushOnly()) {
            return in_array(NotificationChannel::InApp, $channels, true) && ! $held && $this->hasPushDevice($notifiable)
                ? [FcmChannel::class]
                : [];
        }

        foreach ($channels as $channel) {
            // While held (on leave), only the Inbox record is kept: no toast, email or WhatsApp.
            if ($channel === NotificationChannel::InApp) {
                $via[] = InAppChannel::class;

                if (! $held) {
                    $via[] = 'broadcast';

                    // Push follows the In-app preference (one source of truth); only users
                    // with a registered phone get the channel queued.
                    if ($this->hasPushDevice($notifiable)) {
                        $via[] = FcmChannel::class;
                    }
                }
            } elseif (! $held) {
                $via[] = $channel === NotificationChannel::Email ? 'mail' : WhatsAppChannel::class;
            }
        }

        return $via;
    }

    /**
     * Laravel asks this per channel when the (queued) notification is delivered,
     * so access lost between dispatch and delivery is respected.
     */
    final public function shouldSend(object $notifiable, string $channel): bool
    {
        if (! $notifiable instanceof User) {
            return true;
        }

        return $notifiable->isActive() && $this->stillVisibleTo($notifiable);
    }

    /**
     * Whether the recipient may still see what this notification is about.
     * Subclasses about a record (task, comment, project) override this with a
     * trashed check + the record's `view` policy.
     */
    protected function stillVisibleTo(User $notifiable): bool
    {
        return true;
    }

    /**
     * Quiet hours: delay email/WhatsApp until working hours (office timezone).
     */
    public function withDelay(object $notifiable, string $channel): ?DateTimeInterface
    {
        if (! $notifiable instanceof User || ! in_array($channel, ['mail', WhatsAppChannel::class, FcmChannel::class], true)) {
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
        $payload = $user ? $this->externalPayload($user) : new NotificationPayload($this->type()->label());

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
            ? $this->externalPayload($notifiable)
            : new NotificationPayload($this->type()->label());

        $text = trim($payload->title."\n".($payload->body ?? ''));

        return new WhatsAppMessage($text, $payload->url !== null ? url($payload->url) : null);
    }

    private function hasPushDevice(User $user): bool
    {
        return Device::query()->where('user_id', $user->id)->whereNotNull('push_token')->exists();
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
