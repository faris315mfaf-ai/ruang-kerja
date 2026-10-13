<?php

namespace App\Domain\Notifications\Enums;

/**
 * Android notification channels of the mobile app (docs/mockups/android/spec/10-inbox-notifikasi-cari.md §6).
 *
 * One source of truth for the whole stack: the server puts the channel id of
 * the notification type in every push payload (`data.android_channel`, FCM
 * `android.notification.channel_id`) and in every Inbox item
 * (`android_channel`); the app creates exactly these channels at first launch.
 * Importance and lock-screen visibility are hints for channel creation only —
 * Android lets the user override them in the system settings.
 */
enum AndroidChannel: string
{
    case Mendesak = 'rk_mendesak';
    case Tugas = 'rk_tugas';
    case Obrolan = 'rk_obrolan';
    case Rapat = 'rk_rapat';
    case Pengajuan = 'rk_pengajuan';
    case Pengingat = 'rk_pengingat';
    case Proyek = 'rk_proyek';
    case Info = 'rk_info';
    case Keamanan = 'rk_keamanan';
    /** Technical channel for background sync (offline queue); no NotificationType maps here. */
    case Sinkron = 'rk_sinkron';

    public function label(): string
    {
        return match ($this) {
            self::Mendesak => 'Perlu tindakan',
            self::Tugas => 'Tugas & sebutan',
            self::Obrolan => 'Obrolan',
            self::Rapat => 'Rapat',
            self::Pengajuan => 'Pengajuan',
            self::Pengingat => 'Pengingat harian',
            self::Proyek => 'Proyek, OKR & hiring',
            self::Info => 'Pengumuman & briefing',
            self::Keamanan => 'Keamanan akun',
            self::Sinkron => 'Sinkron latar',
        };
    }

    /**
     * Android importance: high (pop-up, sound, vibration) · default (sound,
     * no pop-up) · low (silent) · min (technical, hidden from the list).
     */
    public function importance(): string
    {
        return match ($this) {
            self::Mendesak, self::Tugas, self::Obrolan, self::Rapat, self::Keamanan => 'high',
            self::Pengajuan, self::Pengingat, self::Proyek => 'default',
            self::Info => 'low',
            self::Sinkron => 'min',
        };
    }

    /**
     * Lock-screen visibility: public · private (neutral content on the lock
     * screen: sick requests, applicants and chat text are not shown).
     */
    public function lockscreen(): string
    {
        return match ($this) {
            self::Mendesak, self::Obrolan, self::Pengajuan, self::Proyek, self::Keamanan => 'private',
            default => 'public',
        };
    }

    /**
     * Whether the user may mute the channel from the system settings screen
     * the app links to; security notices should stay audible.
     */
    public function mutable(): bool
    {
        return $this !== self::Keamanan;
    }

    public static function forType(NotificationType $type): self
    {
        return match ($type) {
            NotificationType::RequestSubmitted, NotificationType::RequestRevisionRequested,
            NotificationType::TaskOverdue, NotificationType::ProjectUpdateRequested,
            NotificationType::ProjectDecisionNeeded, NotificationType::ActionItemDue,
            NotificationType::HiringDecisionNeeded => self::Mendesak,

            NotificationType::TaskAssigned, NotificationType::Mention, NotificationType::TaskCommented,
            NotificationType::TaskDueSoon, NotificationType::AutomationNotify => self::Tugas,

            NotificationType::ChatMessage => self::Obrolan,

            NotificationType::MeetingInvited, NotificationType::MeetingStarting,
            NotificationType::MinutesFinalized => self::Rapat,

            NotificationType::RequestApproved, NotificationType::RequestRejected,
            NotificationType::RequestCanceled, NotificationType::RequestVoided => self::Pengajuan,

            NotificationType::CheckInReminder, NotificationType::CheckOutReminder,
            NotificationType::ReportReminder => self::Pengingat,

            NotificationType::ProjectUpdateReminder, NotificationType::ProjectDirection,
            NotificationType::ProjectDecisionResolved, NotificationType::OkrCheckinReminder,
            NotificationType::OkrObjectiveAtRisk, NotificationType::HiringCandidateReceived,
            NotificationType::HiringCandidateDecided => self::Proyek,

            NotificationType::SystemAnnouncement, NotificationType::BriefingPosted,
            NotificationType::SystemTest => self::Info,

            NotificationType::PasswordResetRequested, NotificationType::PasswordSetByHr,
            NotificationType::ConsentRevoked => self::Keamanan,
        };
    }

    /**
     * Channel definitions for the app (settings screen "Notifikasi di ponsel ini").
     *
     * @return list<array{id: string, name: string, importance: string, lockscreen: string, mutable: bool, types: list<string>}>
     */
    public static function definitions(): array
    {
        return array_values(array_map(fn (self $channel): array => [
            'id' => $channel->value,
            'name' => $channel->label(),
            'importance' => $channel->importance(),
            'lockscreen' => $channel->lockscreen(),
            'mutable' => $channel->mutable(),
            'types' => array_values(array_map(
                fn (NotificationType $type): string => $type->value,
                array_filter(NotificationType::cases(), fn (NotificationType $type): bool => self::forType($type) === $channel),
            )),
        ], self::cases()));
    }
}
