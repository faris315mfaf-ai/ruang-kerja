<?php

namespace App\Domain\Attendance\Notifications;

use App\Domain\Attendance\Support\OfficeClock;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * "Belum check-in" reminder, 15 minutes after the scheduled start.
 *
 * TODO(sprint-8): extend App\Domain\Notifications\BaseNotification with
 * NotificationType::CheckInReminder so via() honours notification_preferences.
 * Until then: database channel only, payload in the Sprint 8 shape
 * {type, title, body, url, actor, subject, meta}.
 */
final class CheckInReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public const string TYPE = 'attendance.check_in_reminder';

    public function __construct(
        public readonly string $workDate,
        public readonly string $shiftName,
        public readonly CarbonImmutable $scheduledStart,
    ) {}

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
        $start = OfficeClock::time($this->scheduledStart);

        return [
            'type' => self::TYPE,
            'title' => 'Anda belum check-in',
            'body' => "Shift {$this->shiftName} dimulai pukul {$start}. Lakukan check-in sekarang.",
            'url' => '/absensi',
            'actor' => null,
            'subject' => null,
            'meta' => [
                'work_date' => $this->workDate,
                'open_label' => 'Check-in sekarang',
                'context_tone' => 'warning',
            ],
        ];
    }
}
