<?php

namespace App\Domain\Notifications\Enums;

/**
 * Preference-level events: one row per event in the settings matrix and the
 * value stored in `notification_preferences.event`.
 *
 * Several NotificationTypes may share one event (e.g. approved / rejected /
 * revision all map to RequestDecided). Default channel states come from
 * `config/notifications.php` (`defaults`).
 */
enum NotificationEvent: string
{
    case TaskAssigned = 'task.assigned';
    case Mention = 'mention';
    case TaskCommented = 'task.commented';
    case TaskDueSoon = 'task.due_soon';
    case TaskOverdue = 'task.overdue';
    case ChatMessage = 'chat.message';
    case RequestPending = 'request.pending';
    case RequestDecided = 'request.decided';
    case CheckInReminder = 'attendance.check_in_reminder';
    case CheckOutReminder = 'attendance.check_out_reminder';
    case ProjectActivity = 'project.activity';
    case OkrActivity = 'okr.activity';
    case Automation = 'automation.notify';
    case Meeting = 'meeting';
    case AccountSecurity = 'account.security';
    case ReportReminder = 'report.reminder';
    case HiringActivity = 'hiring.activity';
    case System = 'system';
    case DailyDigest = 'digest.daily';

    public function label(): string
    {
        return match ($this) {
            self::TaskAssigned => 'Ditugaskan ke saya',
            self::Mention => 'Disebut (@mention)',
            self::TaskCommented => 'Komentar di tugas yang saya amati',
            self::TaskDueSoon => 'Tenggat besok',
            self::TaskOverdue => 'Tenggat terlewat',
            self::ChatMessage => 'Pesan langsung & grup obrolan',
            self::Automation => 'Otomasi workspace (aturan "beri tahu")',
            self::RequestPending => 'Pengajuan menunggu persetujuan saya',
            self::RequestDecided => 'Pengajuan saya diputus',
            self::CheckInReminder => 'Pengingat lupa check-in',
            self::CheckOutReminder => 'Pengingat lupa check-out',
            self::ProjectActivity => 'Proyek: pengingat update, arahan & keputusan',
            self::OkrActivity => 'OKR: pengingat check-in & objective berisiko',
            self::Meeting => 'Rapat: undangan, pengingat, notulen & tindak lanjut',
            self::AccountSecurity => 'Keamanan akun: kata sandi',
            self::ReportReminder => 'Pengingat laporan harian (16.30)',
            self::HiringActivity => 'Hiring: kandidat baru & keputusan akhir',
            self::System => 'Pengumuman & info sistem',
            self::DailyDigest => 'Ringkasan harian',
        };
    }

    public function category(): NotificationCategory
    {
        return match ($this) {
            self::TaskAssigned, self::Mention, self::TaskCommented, self::TaskDueSoon, self::TaskOverdue,
            self::ProjectActivity, self::ChatMessage, self::OkrActivity, self::Automation, self::Meeting, self::ReportReminder => NotificationCategory::Task,
            self::RequestPending, self::RequestDecided, self::HiringActivity => NotificationCategory::Request,
            self::CheckInReminder, self::CheckOutReminder => NotificationCategory::Attendance,
            self::AccountSecurity, self::System, self::DailyDigest => NotificationCategory::System,
        };
    }

    /**
     * Channels this event can be delivered on.
     *
     * @return list<NotificationChannel>
     */
    public function channels(): array
    {
        return match ($this) {
            self::DailyDigest => [NotificationChannel::Email],
            default => NotificationChannel::cases(),
        };
    }

    /**
     * Channels that are always on and cannot be switched off by the user.
     * Approvers must always see pending requests in their Inbox, and system
     * notices are always recorded in-app.
     *
     * @return list<NotificationChannel>
     */
    public function lockedChannels(): array
    {
        return match ($this) {
            self::RequestPending, self::System => [NotificationChannel::InApp],
            // Password notices cannot be switched off (security, ASVS V2.2).
            self::AccountSecurity => [NotificationChannel::InApp, NotificationChannel::Email],
            default => [],
        };
    }

    public function supports(NotificationChannel $channel): bool
    {
        return in_array($channel, $this->channels(), true);
    }

    public function isLocked(NotificationChannel $channel): bool
    {
        return in_array($channel, $this->lockedChannels(), true);
    }

    /**
     * Whether a user may change this (event, channel) cell.
     */
    public function isConfigurable(NotificationChannel $channel): bool
    {
        return $this->supports($channel) && ! $this->isLocked($channel) && $channel->isAvailable();
    }

    /**
     * Default state when the user has no preference row.
     */
    public function defaultEnabled(NotificationChannel $channel): bool
    {
        if (! $this->supports($channel)) {
            return false;
        }

        // Event keys contain dots, so read the array instead of using dot notation.
        $defaults = config('notifications.defaults', []);
        $default = is_array($defaults) ? ($defaults[$this->value][$channel->value] ?? null) : null;

        if (is_bool($default)) {
            return $default;
        }

        return $channel === NotificationChannel::InApp;
    }

    /**
     * Events shown as rows in the settings matrix (the digest has its own card).
     *
     * @return list<self>
     */
    public static function matrix(): array
    {
        return array_filter(
            self::cases(),
            fn (self $event): bool => $event !== self::DailyDigest,
        );
    }
}
