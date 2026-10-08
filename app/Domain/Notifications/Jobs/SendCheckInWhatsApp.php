<?php

namespace App\Domain\Notifications\Jobs;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Notifications\Services\EvolutionWhatsApp;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Best-effort copy of a successful check-in to the management WhatsApp
 * group through the Evolution API gateway (owner decision 8 Oct 2026):
 * name, time, status and the day's work plan, so manajemen can follow
 * along from WhatsApp. Disabled while the channel is off; a failing
 * gateway never affects the attendance record itself.
 */
final class SendCheckInWhatsApp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    /** @var list<int> */
    public array $backoff = [60, 300, 900, 1800];

    public int $timeout = 30;

    public function __construct(
        public readonly string $dayId,
    ) {}

    public function handle(EvolutionWhatsApp $whatsapp): void
    {
        $group = config('notifications.channels.whatsapp.group_jid');

        if (! $whatsapp->enabled() || ! is_string($group) || $group === '') {
            return;
        }

        $day = AttendanceDay::query()->with('user:id,name')->find($this->dayId);

        if ($day === null || $day->check_in_at === null || ! $day->user()->exists()) {
            return;
        }

        $whatsapp->sendText($group, self::message($day));
    }

    public static function message(AttendanceDay $day): string
    {
        return sprintf(
            "🟢 *%s* absen masuk\n🕒 %s WIB · %s\n📋 Rencana kerja:\n%s",
            $day->user->name,
            $day->check_in_at?->setTimezone(config('app.office_timezone'))->format('H.i'),
            $day->status->label(),
            $day->work_plan !== null && trim($day->work_plan) !== ''
                ? trim($day->work_plan)
                : '_(tidak diisi — absen lewat QR/kiosk)_',
        );
    }

    public function failed(Throwable $exception): void
    {
        // The group copy is additive; record the loss without noise.
        Log::warning('whatsapp.check-in not delivered', [
            'day' => $this->dayId,
            'error' => $exception->getMessage(),
        ]);
    }
}
