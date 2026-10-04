<?php

namespace App\Domain\Attendance\Notifications;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Support\OfficeClock;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Sent by attendance:close-day when a day is marked "Perlu koreksi" because
 * the check-out is missing.
 *
 * TODO(sprint-8): extend App\Domain\Notifications\BaseNotification with
 * NotificationType::CheckOutReminder so via() honours notification_preferences.
 */
final class MissingCheckOutNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public const string TYPE = 'attendance.check_out_reminder';

    public function __construct(public readonly AttendanceDay $day) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return self::TYPE;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $date = OfficeClock::date($this->day->work_date, dateOnly: true);

        return [
            'type' => self::TYPE,
            'title' => 'Check-out belum tercatat',
            'body' => "Absensi {$date} perlu koreksi karena tidak ada check-out. Ajukan koreksi absensi agar jam kerja tercatat.",
            'url' => '/absensi',
            'actor' => null,
            'subject' => null,
            'meta' => [
                'work_date' => $this->day->work_date->toDateString(),
                'open_label' => 'Lihat absensi',
                'context_tone' => 'warning',
            ],
        ];
    }
}
