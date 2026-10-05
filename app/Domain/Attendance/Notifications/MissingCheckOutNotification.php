<?php

namespace App\Domain\Attendance\Notifications;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Support\OfficeClock;
use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * Sent by attendance:close-day when a day becomes "Perlu koreksi" because the
 * check-out is missing (type attendance.check_out_reminder).
 */
final class MissingCheckOutNotification extends BaseNotification
{
    public function __construct(public readonly AttendanceDay $day) {}

    public function type(): NotificationType
    {
        return NotificationType::CheckOutReminder;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $date = OfficeClock::date($this->day->work_date, dateOnly: true);

        return new NotificationPayload(
            title: 'Check-out belum tercatat',
            body: "Absensi {$date} perlu koreksi karena tidak ada check-out. Ajukan koreksi absensi agar jam kerja tercatat.",
            url: '/absensi',
            subject: NotificationSubject::fromModel($this->day, null, "Absensi {$date}"),
            meta: [
                'work_date' => $this->day->work_date->toDateString(),
                'open_label' => 'Lihat absensi',
                'context_tone' => 'warning',
            ],
        );
    }
}
