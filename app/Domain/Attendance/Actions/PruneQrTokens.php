<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\QrToken;
use Carbon\CarbonInterface;

/**
 * Kiosks record every displayed code (≈2,880 per kiosk per day). Codes that
 * nobody scanned are only useful for a short while; scanned ones stay with
 * their attendance log.
 */
final class PruneQrTokens
{
    public function handle(CarbonInterface $now): int
    {
        return QrToken::query()
            ->where('valid_until', '<', $now->copy()->subDays(config()->integer('attendance.qr.prune_after_days')))
            ->whereNotIn('id', AttendanceLog::query()->select('qr_token_id')->whereNotNull('qr_token_id'))
            ->delete();
    }
}
