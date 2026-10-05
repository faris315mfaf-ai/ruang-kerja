<?php

namespace App\Domain\Attendance\Notifications;

use App\Domain\Attendance\Support\OfficeClock;
use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * "Belum check-in" reminder, sent by SendCheckInReminders 15 minutes after the
 * scheduled start. Channels follow notification_preferences (Sprint 8).
 */
final class CheckInReminderNotification extends BaseNotification
{
    public function __construct(
        public readonly string $workDate,
        public readonly string $shiftName,
        public readonly CarbonImmutable $scheduledStart,
    ) {}

    public function type(): NotificationType
    {
        return NotificationType::CheckInReminder;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: 'Anda belum check-in',
            body: "Shift {$this->shiftName} dimulai pukul ".OfficeClock::time($this->scheduledStart).'. Lakukan check-in sekarang.',
            url: '/absensi',
            meta: [
                'work_date' => $this->workDate,
                'open_label' => 'Check-in sekarang',
                'context_tone' => 'warning',
            ],
        );
    }
}
