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

    // Obrolan (F2-1): new message in a DM / group (mentions use Mention)
    case ChatMessage = 'chat.message';
    // Otomasi (F2-4): "beri tahu" action of a workspace automation rule
    case AutomationNotify = 'automation.notify';
    // Requests & approvals (Sprint 4)
    case RequestSubmitted = 'request.submitted';
    case RequestApproved = 'request.approved';
    case RequestRejected = 'request.rejected';
    case RequestRevisionRequested = 'request.revision_requested';
    case RequestCanceled = 'request.canceled';
    // An approved request voided by HR (to the requester)
    case RequestVoided = 'request.voided';

    // Attendance (Sprint 2)
    case CheckInReminder = 'attendance.check_in_reminder';
    case CheckOutReminder = 'attendance.check_out_reminder';
    // Privacy (Sprint 10): an employee withdrew location/selfie consent → HR.
    case ConsentRevoked = 'attendance.consent_revoked';

    // Projects (Sprint 9, PRD M10)
    case ProjectUpdateReminder = 'project.update_reminder';
    case ProjectUpdateRequested = 'project.update_requested';
    case ProjectDirection = 'project.direction';
    case ProjectDecisionNeeded = 'project.decision_needed';
    case ProjectDecisionResolved = 'project.decision_resolved';

    // OKR divisi (F3-3): weekly check-in reminder, objective status dropped
    case OkrCheckinReminder = 'okr.checkin_reminder';
    case OkrObjectiveAtRisk = 'okr.objective_at_risk';
    // Rapat (F2-3)
    case MeetingInvited = 'meeting.invited';
    case MeetingStarting = 'meeting.starting';
    case MinutesFinalized = 'minutes.finalized';
    case ActionItemDue = 'action_item.due';
    // Account security (owner decision 6 Oct 2026): "Lupa kata sandi" → HR,
    // and the employee is told when HR set their password.
    case PasswordResetRequested = 'account.password_reset_requested';
    case PasswordSetByHr = 'account.password_set_by_hr';
    // Laporan progres harian (keputusan pemilik 6 Okt 2026): 16.30 reminder.
    case ReportReminder = 'report.reminder';
    // Hiring (owner decision 6 Oct 2026, docs/fitur/hiring.md)
    case HiringCandidateReceived = 'hiring.candidate_received';
    case HiringDecisionNeeded = 'hiring.decision_needed';
    case HiringCandidateDecided = 'hiring.candidate_decided';
    // Ruang HR (keputusan pemilik 20 Okt 2026): interview date set/changed for a candidate.
    case HiringInterviewScheduled = 'hiring.interview_scheduled';
    // Briefing pagi & sore (keputusan pemilik 9 Okt 2026): minutes saved and
    // broadcast to the whole company. Informational, no action needed.
    case BriefingPosted = 'briefing.posted';

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
            self::ChatMessage => 'Pesan baru',
            self::AutomationNotify => 'Otomasi',
            self::RequestSubmitted => 'Pengajuan baru',
            self::RequestApproved => 'Pengajuan disetujui',
            self::RequestRejected => 'Pengajuan ditolak',
            self::RequestRevisionRequested => 'Perlu revisi',
            self::RequestCanceled => 'Pengajuan dibatalkan',
            self::RequestVoided => 'Pengajuan disetujui dibatalkan',
            self::CheckInReminder => 'Pengingat check-in',
            self::CheckOutReminder => 'Pengingat check-out',
            self::ConsentRevoked => 'Persetujuan data dicabut',
            self::ProjectUpdateReminder => 'Pengingat update proyek',
            self::ProjectUpdateRequested => 'Diminta update proyek',
            self::ProjectDirection => 'Arahan Direksi',
            self::ProjectDecisionNeeded => 'Butuh keputusan',
            self::ProjectDecisionResolved => 'Keputusan diberikan',
            self::OkrCheckinReminder => 'Pengingat check-in OKR',
            self::OkrObjectiveAtRisk => 'Objective berisiko',
            self::MeetingInvited => 'Undangan rapat',
            self::MeetingStarting => 'Rapat segera dimulai',
            self::MinutesFinalized => 'Notulen rapat',
            self::ActionItemDue => 'Tindak lanjut rapat',
            self::PasswordResetRequested => 'Permintaan reset kata sandi',
            self::PasswordSetByHr => 'Kata sandi diatur ulang',
            self::ReportReminder => 'Pengingat laporan harian',
            self::HiringCandidateReceived => 'Kandidat baru',
            self::HiringDecisionNeeded => 'Keputusan kandidat',
            self::HiringCandidateDecided => 'Kandidat diputus',
            self::HiringInterviewScheduled => 'Jadwal wawancara',
            self::BriefingPosted => 'Briefing',
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
            self::ChatMessage => NotificationEvent::ChatMessage,
            self::AutomationNotify => NotificationEvent::Automation,
            self::RequestSubmitted, self::RequestCanceled => NotificationEvent::RequestPending,
            self::RequestApproved, self::RequestRejected, self::RequestRevisionRequested, self::RequestVoided => NotificationEvent::RequestDecided,
            self::CheckInReminder => NotificationEvent::CheckInReminder,
            self::CheckOutReminder => NotificationEvent::CheckOutReminder,
            // Compliance notice for HR: in-app is locked on (cannot be switched off).
            self::ConsentRevoked => NotificationEvent::System,
            self::ProjectUpdateReminder, self::ProjectUpdateRequested, self::ProjectDirection,
            self::ProjectDecisionNeeded, self::ProjectDecisionResolved => NotificationEvent::ProjectActivity,
            self::OkrCheckinReminder, self::OkrObjectiveAtRisk => NotificationEvent::OkrActivity,
            self::MeetingInvited, self::MeetingStarting, self::MinutesFinalized, self::ActionItemDue => NotificationEvent::Meeting,
            self::PasswordResetRequested, self::PasswordSetByHr => NotificationEvent::AccountSecurity,
            self::ReportReminder => NotificationEvent::ReportReminder,
            self::HiringCandidateReceived, self::HiringDecisionNeeded, self::HiringCandidateDecided, self::HiringInterviewScheduled => NotificationEvent::HiringActivity,
            self::BriefingPosted => NotificationEvent::BriefingPosted,
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
            self::TaskCommented, self::ChatMessage => 'message',
            self::AutomationNotify => 'workflow',
            self::TaskDueSoon => 'calendar-clock',
            self::TaskOverdue => 'alert',
            self::RequestSubmitted => 'check-check',
            self::RequestApproved => 'check-check',
            self::RequestRejected, self::RequestCanceled, self::RequestVoided => 'x',
            self::RequestRevisionRequested => 'rotate',
            self::CheckInReminder, self::CheckOutReminder => 'alarm',
            self::ConsentRevoked => 'shield',
            self::ProjectUpdateReminder => 'alarm',
            self::ProjectUpdateRequested => 'rotate',
            self::ProjectDirection => 'message',
            self::ProjectDecisionNeeded => 'alert',
            self::ProjectDecisionResolved => 'check-check',
            self::OkrCheckinReminder => 'alarm',
            self::OkrObjectiveAtRisk => 'target',
            self::MeetingInvited, self::MeetingStarting => 'video',
            self::MinutesFinalized => 'notebook',
            self::ActionItemDue => 'calendar-clock',
            self::PasswordResetRequested, self::PasswordSetByHr => 'key',
            self::ReportReminder => 'clipboard',
            self::HiringCandidateReceived => 'user-plus',
            self::HiringDecisionNeeded => 'check-check',
            self::HiringCandidateDecided => 'user-check',
            self::HiringInterviewScheduled => 'calendar-clock',
            self::BriefingPosted => 'notebook',
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
            self::TaskDueSoon, self::RequestRevisionRequested, self::CheckInReminder, self::CheckOutReminder, self::ConsentRevoked,
            self::ProjectUpdateReminder, self::ProjectUpdateRequested, self::OkrCheckinReminder, self::OkrObjectiveAtRisk, self::PasswordResetRequested, self::ReportReminder => 'warning',
            self::PasswordSetByHr => 'info',
            self::TaskOverdue, self::RequestRejected, self::RequestVoided => 'danger',
            self::ProjectDirection, self::ProjectDecisionNeeded => 'info',
            self::ProjectDecisionResolved => 'success',
            self::MeetingInvited, self::MinutesFinalized => 'info',
            self::MeetingStarting, self::ActionItemDue => 'warning',
            self::HiringCandidateReceived, self::HiringDecisionNeeded, self::HiringCandidateDecided, self::HiringInterviewScheduled => 'info',
            self::BriefingPosted => 'info',
            self::TaskAssigned, self::TaskCommented, self::RequestCanceled, self::ChatMessage => 'neutral',
            self::AutomationNotify => 'primary',
        };
    }

    /**
     * Whether the recipient is expected to act ("Perlu tindakan" in the Inbox)
     * until the module resolves it.
     */
    public function requiresAction(): bool
    {
        return match ($this) {
            self::TaskOverdue, self::RequestSubmitted, self::RequestRevisionRequested,
            self::ProjectUpdateRequested, self::ProjectDecisionNeeded, self::ActionItemDue, self::PasswordResetRequested, self::HiringDecisionNeeded => true,
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
