<?php

namespace App\Domain\Notifications\Enums;

/**
 * Fine-grained notification kinds. Stored in `notifications.type` and sent as
 * `type` in every payload. Modules reference these when they notify; add a
 * case here when a module needs a new kind (see docs/sprints/sprint-8/HOW-TO-NOTIFY.md).
 */
enum NotificationType: string
{
    // Tasks (Sprint 5/6)
    case TaskAssigned = 'task.assigned';
    case Mention = 'mention';
    case TaskCommented = 'task.commented';
    case TaskDueSoon = 'task.due_soon';
    case TaskOverdue = 'task.overdue';

    // Requests & approvals (Sprint 4)
    case RequestSubmitted = 'request.submitted';
    case RequestApproved = 'request.approved';
    case RequestRejected = 'request.rejected';
    case RequestRevisionRequested = 'request.revision_requested';

    // Attendance (Sprint 2)
    case CheckInReminder = 'attendance.check_in_reminder';
    case CheckOutReminder = 'attendance.check_out_reminder';

    // System (Sprint 8)
    case SystemAnnouncement = 'system.announcement';
    case SystemTest = 'system.test';

    public function label(): string
    {
        return match ($this) {
            self::TaskAssigned => 'Ditugaskan',
            self::Mention => 'Disebut',
            self::TaskCommented => 'Komentar',
            self::TaskDueSoon => 'Tenggat besok',
            self::TaskOverdue => 'Tenggat terlewat',
            self::RequestSubmitted => 'Pengajuan baru',
            self::RequestApproved => 'Pengajuan disetujui',
            self::RequestRejected => 'Pengajuan ditolak',
            self::RequestRevisionRequested => 'Perlu revisi',
            self::CheckInReminder => 'Pengingat check-in',
            self::CheckOutReminder => 'Pengingat check-out',
            self::SystemAnnouncement => 'Pengumuman',
            self::SystemTest => 'Notifikasi uji',
        };
    }

    /**
     * The preference row that controls this kind.
     */
    public function event(): NotificationEvent
    {
        return match ($this) {
            self::TaskAssigned => NotificationEvent::TaskAssigned,
            self::Mention => NotificationEvent::Mention,
            self::TaskCommented => NotificationEvent::TaskCommented,
            self::TaskDueSoon => NotificationEvent::TaskDueSoon,
            self::TaskOverdue => NotificationEvent::TaskOverdue,
            self::RequestSubmitted => NotificationEvent::RequestPending,
            self::RequestApproved, self::RequestRejected, self::RequestRevisionRequested => NotificationEvent::RequestDecided,
            self::CheckInReminder => NotificationEvent::CheckInReminder,
            self::CheckOutReminder => NotificationEvent::CheckOutReminder,
            self::SystemAnnouncement, self::SystemTest => NotificationEvent::System,
        };
    }

    public function category(): NotificationCategory
    {
        return $this->event()->category();
    }

    /**
     * Icon key understood by the frontend (features/notifications/notification-icon.tsx).
     */
    public function icon(): string
    {
        return match ($this) {
            self::TaskAssigned => 'plus',
            self::Mention => 'at-sign',
            self::TaskCommented => 'message',
            self::TaskDueSoon => 'calendar-clock',
            self::TaskOverdue => 'alert',
            self::RequestSubmitted => 'check-check',
            self::RequestApproved => 'check-check',
            self::RequestRejected => 'x',
            self::RequestRevisionRequested => 'rotate',
            self::CheckInReminder, self::CheckOutReminder => 'alarm',
            self::SystemAnnouncement => 'megaphone',
            self::SystemTest => 'bell',
        };
    }

    /**
     * Color tone key (primary · info · success · warning · danger · neutral).
     */
    public function tone(): string
    {
        return match ($this) {
            self::Mention, self::SystemTest => 'primary',
            self::RequestSubmitted, self::SystemAnnouncement => 'info',
            self::RequestApproved => 'success',
            self::TaskDueSoon, self::RequestRevisionRequested, self::CheckInReminder, self::CheckOutReminder => 'warning',
            self::TaskOverdue, self::RequestRejected => 'danger',
            self::TaskAssigned, self::TaskCommented => 'neutral',
        };
    }

    /**
     * Whether the recipient is expected to act ("Perlu tindakan" in the Inbox)
     * until the module resolves it.
     */
    public function requiresAction(): bool
    {
        return match ($this) {
            self::TaskOverdue, self::RequestSubmitted, self::RequestRevisionRequested => true,
            default => false,
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $type): string => $type->value, self::cases());
    }
}
