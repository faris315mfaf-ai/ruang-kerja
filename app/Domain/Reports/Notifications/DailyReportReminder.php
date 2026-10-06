<?php

namespace App\Domain\Reports\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Reports\Support\ReportDay;
use App\Models\DailyReport;
use App\Models\User;

/**
 * 16.30 office time on a scheduled working day: today's daily report has not
 * been sent yet (keputusan pemilik 6 Okt 2026). In-app by default
 * (`report.reminder` preference). Dropped when the report was sent while
 * the notification was queued.
 */
final class DailyReportReminder extends BaseNotification
{
    public function __construct(public readonly string $date) {}

    public function type(): NotificationType
    {
        return NotificationType::ReportReminder;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: 'Laporan hari ini belum dikirim',
            body: 'Tulis progres kerja, hambatan, dan catatan Anda. Laporan bisa diubah sampai pukul 23.59.',
            url: '/laporan/hari-ini',
            meta: ['open_label' => 'Tulis laporan', 'context' => 'hari ini', 'context_tone' => 'warning'],
        );
    }

    protected function stillVisibleTo(User $notifiable): bool
    {
        return $this->date === ReportDay::today()
            && DailyReport::query()->where('user_id', $notifiable->id)->whereDate('report_date', $this->date)->whereNotNull('submitted_at')->doesntExist();
    }
}
