<?php

namespace App\Http\Controllers\Api\Briefings;

use App\Domain\Briefings\Queries\LatestBriefing;
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
    public function __invoke(#[CurrentUser] User $user, LatestBriefing $latest): JsonResponse|Response
    {
        Gate::authorize('viewAny', Briefing::class);

        $briefing = $latest->find($user);

        if ($briefing === null) {
            return response()->noContent();
        }

        Gate::authorize('view', $briefing);

        return response()->json(['briefing' => LatestBriefing::present($briefing)]);
    }
}
