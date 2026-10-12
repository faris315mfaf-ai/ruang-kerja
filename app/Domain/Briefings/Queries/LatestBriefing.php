<?php

namespace App\Domain\Briefings\Queries;

use App\Models\Briefing;
use App\Models\User;

/**
 * "Briefing terakhir" (keputusan pemilik 9 Okt 2026): the newest note of the
 * viewer's company, for every active employee — the mobile home screen
 * (GET /api/v1/briefing/terakhir) and the `latestBriefing` prop of the
 * personal dashboard share this one shape. Null when none has been recorded
 * yet. Access matches BriefingPolicy::viewAny/view (company employees).
 */
final class LatestBriefing
{
    /**
     * @return array{period: string, label: string, date: string, content: string, oleh: string, updated_at: string|null}|null
     */
    public function for(User $viewer): ?array
    {
        if (! $viewer->isActive()) {
            return null;
        }

        $briefing = $this->find($viewer);

        return $briefing === null ? null : self::present($briefing);
    }

    /**
     * 'sore' sorts after 'pagi', so the same-date tie-break picks the later
     * period (one row per company + date + period).
     */
    public function find(User $viewer): ?Briefing
    {
        return Briefing::query()
            ->with('creator:id,name')
            ->where('company_id', $viewer->company_id)
            ->orderByDesc('briefing_date')
            ->orderByRaw('period desc')
            ->first();
    }

    /**
     * @return array{period: string, label: string, date: string, content: string, oleh: string, updated_at: string|null}
     */
    public static function present(Briefing $briefing): array
    {
        return [
            'period' => $briefing->period->value,
            'label' => $briefing->period->label(),
            'date' => $briefing->briefing_date->toDateString(),
            'content' => $briefing->content,
            'oleh' => $briefing->creator->name,
            'updated_at' => $briefing->updated_at?->toIso8601String(),
        ];
    }
}
