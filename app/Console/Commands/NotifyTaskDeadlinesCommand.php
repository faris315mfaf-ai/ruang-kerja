<?php

namespace App\Console\Commands;

use App\Domain\Tasks\Actions\SendDeadlineNotifications;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Scheduled daily at 07:00 office time (routes/console.php). Safe to run
 * repeatedly: each reminder is sent once (NotificationHistory).
 */
#[Signature('tasks:notify-deadlines')]
#[Description('Kirim pengingat tenggat tugas: H-1 dan terlambat')]
final class NotifyTaskDeadlinesCommand extends Command
{
    public function handle(SendDeadlineNotifications $send): int
    {
        $report = $send->handle();

        $this->info("{$report['due_soon']} pengingat tenggat besok, {$report['overdue']} pengingat terlambat.");

        return self::SUCCESS;
    }
}
