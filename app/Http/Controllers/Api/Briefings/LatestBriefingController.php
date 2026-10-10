<?php

namespace App\Http\Controllers\Api\Briefings;

use App\Http\Controllers\Controller;
use App\Models\Briefing;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/**
 * "Briefing terakhir" of the mobile home screen (Tahap 1): the newest note
 * of the caller's company (BriefingPolicy::view — every active employee),
 * or 204 when none has been recorded yet. Recording and delegation stay on
 * the web.
 */
class LatestBriefingController extends Controller
{
    public function __invoke(#[CurrentUser] User $user): JsonResponse|Response
    {
        Gate::authorize('viewAny', Briefing::class);

        // 'sore' sorts after 'pagi', so the same-date tie-break picks the
        // later period (one row per company + date + period).
        $briefing = Briefing::query()
            ->where('company_id', $user->company_id)
            ->orderByDesc('briefing_date')
            ->orderByRaw('period desc')
            ->first();

        if ($briefing === null) {
            return response()->noContent();
        }

        Gate::authorize('view', $briefing);

        return response()->json([
            'briefing' => [
                'period' => $briefing->period->value,
                'label' => $briefing->period->label(),
                'date' => $briefing->briefing_date->toDateString(),
                'content' => $briefing->content,
                'oleh' => $briefing->creator->name,
                'updated_at' => $briefing->updated_at?->toIso8601String(),
            ],
        ]);
    }
}
